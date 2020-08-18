'use strict';

const expect = require('chai').expect;
const AwsProvider = require('../../../../provider/awsProvider');
const AwsCompileMSKEvents = require('./index');
const Serverless = require('../../../../../../Serverless');

describe('AwsCompileMSKEvents', () => {
  let serverless;
  let awsCompileMSKEvents;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.service.provider.compiledCloudFormationTemplate = {
      Resources: {
        IamRoleLambdaExecution: {
          Properties: {
            Policies: [
              {
                PolicyDocument: {
                  Statement: [],
                },
              },
            ],
          },
        },
      },
    };
    serverless.setProvider('aws', new AwsProvider(serverless));
    awsCompileMSKEvents = new AwsCompileMSKEvents(serverless);
    awsCompileMSKEvents.serverless.service.service = 'new-service';
  });

  describe('#constructor()', () => {
    it('should set the provider variable to be an instance of AwsProvider', () =>
      expect(awsCompileMSKEvents.provider).to.be.instanceof(AwsProvider));
  });

  describe('#compileMSKEvents()', () => {
    it('should throw an error if kafka event type is not an object', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: 42,
            },
          ],
        },
      };

      expect(() => awsCompileMSKEvents.compileMSKEvents()).to.throw(Error);
    });

    it('should throw an error if the "clusterArn" property is not given', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: null,
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      expect(() => awsCompileMSKEvents.compileMSKEvents()).to.throw(Error);
    });

    it('should throw an error if the "topic" property is not given', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
              },
            },
          ],
        },
      };

      expect(() => awsCompileMSKEvents.compileMSKEvents()).to.throw(Error);
    });

    it('should throw an error if the "topic" property is not a string', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: { some: 'Value' },
              },
            },
          ],
        },
      };

      expect(() => awsCompileMSKEvents.compileMSKEvents()).to.throw(Error);
    });

    it('should not throw error or merge role statements if default policy is not present', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role is set in function', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          role: 'arn:aws:iam::account:role/foo',
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);

      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.be.instanceof(Array);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn.length
      ).to.equal(0);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role name reference is set in function', () => {
      const roleLogicalId = 'RoleLogicalId';
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          role: roleLogicalId,
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.equal(roleLogicalId);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role reference is set in function', () => {
      const roleLogicalId = 'RoleLogicalId';
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          role: { 'Fn::GetAtt': [roleLogicalId, 'Arn'] },
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.equal(roleLogicalId);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role is set in provider', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      awsCompileMSKEvents.serverless.service.provider.role = 'arn:aws:iam::account:role/foo';

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.be.instanceof(Array);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn.length
      ).to.equal(0);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if IAM role is imported', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          role: { 'Fn::ImportValue': 'ExportedRoleId' },
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn.length
      ).to.equal(0);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role reference is set in provider', () => {
      const roleLogicalId = 'RoleLogicalId';
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      awsCompileMSKEvents.serverless.service.provider.role = {
        'Fn::GetAtt': [roleLogicalId, 'Arn'],
      };

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.equal(roleLogicalId);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    it('should not throw error if custom IAM role name reference is set in provider', () => {
      const roleLogicalId = 'RoleLogicalId';
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn: 'arn:aws:kafka:region:account:cluster/my-cluster/UUID',
                topic: 'MyTopic',
              },
            },
          ],
        },
      };

      // pretend that the default IamRoleLambdaExecution is not in place
      awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources.IamRoleLambdaExecution = null;

      awsCompileMSKEvents.serverless.service.provider.role = roleLogicalId;

      expect(() => {
        awsCompileMSKEvents.compileMSKEvents();
      }).to.not.throw(Error);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .FirstEventSourceMappingMSKMyclusterMyTopic.DependsOn
      ).to.equal(roleLogicalId);
      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution
      ).to.equal(null);
    });

    describe('when a kafka ARN is given', () => {
      it('should create event source mappings when a cluster ARN and topic are given', () => {
        awsCompileMSKEvents.serverless.service.functions = {
          first: {
            events: [
              {
                kafka: {
                  clusterArn:
                    'arn:aws:kafka:region:account:cluster/MyCluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
                  topic: 'FirstTopic',
                  batchSize: 1,
                  enabled: false,
                  startingPosition: 'LATEST',
                },
              },
              {
                kafka: {
                  clusterArn:
                    'arn:aws:kafka:region:account:cluster/MyCluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
                  topic: 'SecondTopic',
                },
              },
            ],
          },
        };

        awsCompileMSKEvents.compileMSKEvents();

        // event 1
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Type
        ).to.equal('AWS::Lambda::EventSourceMapping');
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.DependsOn
        ).to.equal('IamRoleLambdaExecution');
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Properties.EventSourceArn
        ).to.equal(
          awsCompileMSKEvents.serverless.service.functions.first.events[0].kafka.clusterArn
        );
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Properties.Topics
        ).to.deep.equal([
          awsCompileMSKEvents.serverless.service.functions.first.events[0].kafka.topic,
        ]);
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Properties.BatchSize
        ).to.equal(
          awsCompileMSKEvents.serverless.service.functions.first.events[0].kafka.batchSize
        );
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Properties.StartingPosition
        ).to.equal(
          awsCompileMSKEvents.serverless.service.functions.first.events[0].kafka.startingPosition
        );
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterFirstTopic.Properties.Enabled
        ).to.equal(false);

        // event 2
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Type
        ).to.equal('AWS::Lambda::EventSourceMapping');
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.DependsOn
        ).to.equal('IamRoleLambdaExecution');
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Properties.EventSourceArn
        ).to.equal(
          awsCompileMSKEvents.serverless.service.functions.first.events[1].kafka.clusterArn
        );
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Properties.Topics
        ).to.deep.equal([
          awsCompileMSKEvents.serverless.service.functions.first.events[1].kafka.topic,
        ]);
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Properties.BatchSize
        ).to.equal(10);
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Properties.StartingPosition
        ).to.equal('TRIM_HORIZON');
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKMyClusterSecondTopic.Properties.Enabled
        ).to.equal(true);
      });

      it('should allow specifying Kafka clusters as CFN reference types', () => {
        awsCompileMSKEvents.serverless.service.functions = {
          first: {
            events: [
              {
                kafka: {
                  clusterArn: { 'Fn::GetAtt': ['SomeCluster', 'Arn'] },
                  topic: 'SomeTopic',
                },
              },
              {
                kafka: {
                  clusterArn: { 'Fn::ImportValue': 'ForeignCluster' },
                  topic: 'SomeTopic',
                },
              },
            ],
          },
        };

        awsCompileMSKEvents.compileMSKEvents();

        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement[0]
        ).to.deep.equal({
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
          Effect: 'Allow',
          Resource: [
            {
              'Fn::GetAtt': ['SomeCluster', 'Arn'],
            },
            {
              'Fn::ImportValue': 'ForeignCluster',
            },
          ],
        });
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKSomeClusterSomeTopic.Properties.EventSourceArn
        ).to.deep.equal({ 'Fn::GetAtt': ['SomeCluster', 'Arn'] });
        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .FirstEventSourceMappingMSKForeignClusterSomeTopic.Properties.EventSourceArn
        ).to.deep.equal({ 'Fn::ImportValue': 'ForeignCluster' });
      });

      it('fails if keys other than Fn::GetAtt/ImportValue are used for dynamic ARNs', () => {
        awsCompileMSKEvents.serverless.service.functions = {
          first: {
            events: [
              {
                kafka: {
                  clusterArn: {
                    'Fn::GetAtt': ['SomeCluster', 'Arn'],
                    'batchSize': 1,
                  },
                  topic: 'SomeTopic',
                },
              },
            ],
          },
        };

        expect(() => awsCompileMSKEvents.compileMSKEvents()).to.throw(Error);
      });

      it('should add the necessary IAM role statements', () => {
        awsCompileMSKEvents.serverless.service.functions = {
          first: {
            events: [
              {
                kafka: {
                  clusterArn:
                    'arn:aws:kafka:region:account:cluster/MyCluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
                  topic: 'FirstTopic',
                },
              },
              {
                kafka: {
                  clusterArn:
                    'arn:aws:kafka:region:account:cluster/MyCluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
                  topic: 'SecondTopic',
                },
              },
            ],
          },
        };

        const iamRoleStatements = [
          {
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
            Resource: [
              'arn:aws:kafka:region:account:cluster/MyCluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
            ],
          },
        ];

        awsCompileMSKEvents.compileMSKEvents();

        expect(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
            .IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement
        ).to.deep.equal(iamRoleStatements);
      });
    });

    it('should not create event source mapping when kafka events are not given', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [],
        },
      };

      awsCompileMSKEvents.compileMSKEvents();

      // should be 1 because we've mocked the IamRoleLambdaExecution above
      expect(
        Object.keys(
          awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
        ).length
      ).to.equal(1);
    });

    it('should not add the IAM role statements when kafka events are not given', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [],
        },
      };

      awsCompileMSKEvents.compileMSKEvents();

      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
          .IamRoleLambdaExecution.Properties.Policies[0].PolicyDocument.Statement.length
      ).to.equal(0);
    });

    it('should remove all non-alphanumerics from cluster and topic names for the resource logical ids', () => {
      awsCompileMSKEvents.serverless.service.functions = {
        first: {
          events: [
            {
              kafka: {
                clusterArn:
                  'arn:aws:kafka:region:account:cluster/my-cluster/abcd1234-abcd-dcba-4321-a1b2abcd9f9f-1',
                topic: 'first-topic',
              },
            },
          ],
        },
      };

      awsCompileMSKEvents.compileMSKEvents();

      expect(
        awsCompileMSKEvents.serverless.service.provider.compiledCloudFormationTemplate.Resources
      ).to.have.any.keys('FirstEventSourceMappingMSKMyclusterFirsttopic');
    });
  });
});
