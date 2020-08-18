'use strict';

const _ = require('lodash');
const resolveLambdaTarget = require('../../../../utils/resolveLambdaTarget');

class AwsCompileMSKEvents {
  constructor(serverless) {
    this.serverless = serverless;
    this.provider = this.serverless.getProvider('aws');

    this.hooks = {
      'package:compileEvents': this.compileMSKEvents.bind(this),
    };

    this.serverless.configSchemaHandler.defineFunctionEvent('aws', 'kafka', {
      anyOf: [{ type: 'string' }, { type: 'object' }],
    });
  }

  compileMSKEvents() {
    this.serverless.service.getAllFunctions().forEach(functionName => {
      const functionObj = this.serverless.service.getFunction(functionName);

      if (functionObj.events) {
        const mskStatement = {
          Effect: 'Allow',
          Action: [
            'kafka:DescribeCluster',
            'kafka:GetBootstrapBrokers',
            'ec2:CreateNetworkInterface',
            'ec2:DeleteNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DescribeSecurityGroups',
            'ec2:DescribeSubnets',
            'ec2:DescribeVpcs',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          Resource: [],
        };

        functionObj.events.forEach(event => {
          if (event.kafka) {
            let EventSourceArn;
            let Topics;
            let BatchSize = 10;
            let StartingPosition = 'TRIM_HORIZON';
            let Enabled = true;

            // TODO validate arn syntax
            if (typeof event.kafka === 'object') {
              if (!event.kafka.clusterArn) {
                const errorMessage = [
                  `Missing "clusterArn" property for kafka event in function "${functionName}"`,
                  ' The correct syntax is an object with a "clusterArn" property',
                  ' and a "topic" property. Please check the docs for more info.',
                ].join('');
                throw new this.serverless.classes.Error(errorMessage);
              }
              if (typeof event.kafka.clusterArn !== 'string') {
                // for dynamic arns (GetAtt/ImportValue)
                if (
                  Object.keys(event.kafka.clusterArn).length !== 1 ||
                  !(
                    event.kafka.clusterArn['Fn::ImportValue'] ||
                    event.kafka.clusterArn['Fn::GetAtt']
                  )
                ) {
                  const errorMessage = [
                    `Bad dynamic ARN property on kafka event in function "${functionName}"`,
                    ' If you use a dynamic "clusterArn" (such as with Fn::GetAtt or Fn::ImportValue)',
                    ' there must only be one key (either Fn::GetAtt or Fn::ImportValue) in the arn',
                    ' object. Please check the docs for more info.',
                  ].join('');
                  throw new this.serverless.classes.Error(errorMessage);
                }
              }

              if (!event.kafka.topic) {
                const errorMessage = [
                  `Missing "topic" property for kafka event in function "${functionName}"`,
                  ' The correct syntax is an object with a "clusterArn" property',
                  ' and a "topic" property. Please check the docs for more info.',
                ].join('');
                throw new this.serverless.classes.Error(errorMessage);
              }
              if (typeof event.kafka.topic !== 'string') {
                const errorMessage = [
                  `Bad topic name on kafka event in function "${functionName}"`,
                  ' The topic must be a string. Please check the docs for more info.',
                ].join('');
                throw new this.serverless.classes.Error(errorMessage);
              }

              EventSourceArn = event.kafka.clusterArn;
              Topics = [event.kafka.topic];
              BatchSize = event.kafka.batchSize || BatchSize;
              if (typeof event.kafka.startingPosition !== 'undefined') {
                StartingPosition = event.kafka.startingPosition;
              }
              if (typeof event.kafka.enabled !== 'undefined') {
                Enabled = event.kafka.enabled;
              }
            } else {
              const errorMessage = [
                `Kafka event of function "${functionName}" is not an object`,
                ' The correct syntax is an object with a "clusterArn" property',
                ' and a "topic" property. Please check the docs for more info.',
              ].join('');
              throw new this.serverless.classes.Error(errorMessage);
            }

            const clusterName = (function() {
              if (EventSourceArn['Fn::GetAtt']) {
                return EventSourceArn['Fn::GetAtt'][0];
              } else if (EventSourceArn['Fn::ImportValue']) {
                return EventSourceArn['Fn::ImportValue'];
              }
              return EventSourceArn.split('/')[1];
            })();

            const clusterTopicLogicalId = this.provider.naming.getClusterTopicLogicalId(
              functionName,
              clusterName,
              Topics[0]
            );

            const funcRole = functionObj.role || this.serverless.service.provider.role;
            let dependsOn = '"IamRoleLambdaExecution"';
            if (funcRole) {
              if (
                // check whether the custom role is an ARN
                typeof funcRole === 'string' &&
                funcRole.indexOf(':') !== -1
              ) {
                dependsOn = '[]';
              } else if (
                // otherwise, check if we have an in-service reference to a role ARN
                typeof funcRole === 'object' &&
                'Fn::GetAtt' in funcRole &&
                Array.isArray(funcRole['Fn::GetAtt']) &&
                funcRole['Fn::GetAtt'].length === 2 &&
                typeof funcRole['Fn::GetAtt'][0] === 'string' &&
                typeof funcRole['Fn::GetAtt'][1] === 'string' &&
                funcRole['Fn::GetAtt'][1] === 'Arn'
              ) {
                dependsOn = `"${funcRole['Fn::GetAtt'][0]}"`;
              } else if (
                // otherwise, check if we have an import
                typeof funcRole === 'object' &&
                'Fn::ImportValue' in funcRole
              ) {
                dependsOn = '[]';
              } else if (typeof funcRole === 'string') {
                dependsOn = `"${funcRole}"`;
              }
            }
            const mskTemplate = `
              {
                "Type": "AWS::Lambda::EventSourceMapping",
                "DependsOn": ${dependsOn},
                "Properties": {
                  "BatchSize": ${BatchSize},
                  "Enabled": ${Enabled},
                  "EventSourceArn": ${JSON.stringify(EventSourceArn)},
                  "FunctionName": ${JSON.stringify(resolveLambdaTarget(functionName, functionObj))},
                  "StartingPosition": "${StartingPosition}",
                  "Topics": ${JSON.stringify(Topics)}
                }
              }
            `;

            // Add distinct event source ARNs to PolicyDocument statements.
            // Since each topic subscription requires a separate event, there
            // can be more than one of the same EventSourceArn.
            if (!mskStatement.Resource.includes(EventSourceArn)) {
              mskStatement.Resource.push(EventSourceArn);
            }

            const newMSKObject = {
              [clusterTopicLogicalId]: JSON.parse(mskTemplate),
            };

            _.merge(
              this.serverless.service.provider.compiledCloudFormationTemplate.Resources,
              newMSKObject
            );
          }
        });

        // update the PolicyDocument statements (if default policy is used)
        if (
          this.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .IamRoleLambdaExecution
        ) {
          const statement = this.serverless.service.provider.compiledCloudFormationTemplate
            .Resources.IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement;
          if (mskStatement.Resource.length) {
            statement.push(mskStatement);
          }
        }
      }
    });
  }
}

module.exports = AwsCompileMSKEvents;
