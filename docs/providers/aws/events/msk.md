<!--
title: Serverless Framework - AWS Lambda Events - MSK
menuText: MSK
menuOrder: 18
description:  Setting up Kafka Triggers with AWS Lambda via the Serverless Framework
layout: Doc
-->

<!-- DOCS-SITE-LINK:START automatically generated  -->

### [Read this on the main serverless docs site](https://www.serverless.com/framework/docs/providers/aws/events/msk)

<!-- DOCS-SITE-LINK:END -->

# Managed Streaming for Apache Kafka

In the following example, we specify that the `compute` function should be triggered whenever a new message is added to the Kafka topic.

The ARN for the Kafka cluster ARN can be specified as a string, the reference to the ARN of a resource by logical ID, or the import of an ARN that was exported by a different service or CloudFormation stack.

**Note:** The `kafka` event will hook up your existing Kafka cluster to a Lambda function. Serverless won't create a new queue for you.

```yml
functions:
  compute:
    handler: handler.compute
    events:
      # These are all possible formats
      - kafka:
          clusterArn: arn:aws:kafka:region:XXXXXX:cluster/MyCluster/XXXXXX
          topic: MyTopic
      - kafka:
          clusterArn:
            Fn::GetAtt:
              - MySecondCluster
              - Arn
          topic: SomeOtherTopic
      - kafka:
          clusterArn:
            Fn::ImportValue: MyExportedClusterArnId
          topic: YetAnotherTopic
```

## Setting the BatchSize and StartingPosition

For the MSK event integration, you can set the `batchSize`, which effects how many Kafka messages can be included in a single Lambda invocation. The default `batchSize` is 10, and the max `batchSize` is 10,000.

You can also set the `startingPosition`, which describes at what point in the stream the Lambda will start reading. The valid `startingPosition` values are `TRIM_HORIZON` and `LATEST`, and the default value is `TRIM_HORIZON`.

```yml
functions:
  compute:
    handler: handler.compute
    events:
      - kafka:
          clusterArn: arn:aws:kafka:region:XXXXXX:cluster/MyCluster/XXXXXX
          topic: MyTopic
          batchSize: 10
          startingPosition: TRIM_HORIZON
```

## IAM Permissions

The Serverless Framework will automatically configure the most minimal set of IAM permissions for you. However you can still add additional permissions if you need to. Read the official [AWS documentation](https://docs.aws.amazon.com/lambda/latest/dg/with-msk.html) for more information about IAM Permissions for MSK events.
