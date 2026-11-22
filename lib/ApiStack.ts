import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as apigw from "aws-cdk-lib/aws-apigateway"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'node:path'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Duration } from 'aws-cdk-lib'
import * as cognito from "aws-cdk-lib/aws-cognito"

interface AuthStackProps extends cdk.StackProps { 
  userPool: cognito.UserPool
} 

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props)

    // Pulls existing VPC
    const vpc = ec2.Vpc.fromVpcAttributes(this, 'VPC', {
        vpcId: 'vpc-0e60f0a4fbd4f0183',                                    
        availabilityZones: ['us-east-1a', 'us-east-1b', 'us-east-1c'],       
        privateSubnetIds: ['subnet-04b2d39e459725e17', 'subnet-0d8a653b772b55650', 'subnet-04e1b54924e5f9d3d'], 
    })

    // Pulls existing SG
    const securityGroup = ec2.SecurityGroup.fromSecurityGroupId(this, 'SG', 'sg-04a27b0bfdcd4b9f6', {
        mutable: false
    })

    const db_env = {
      "RDS_USER": process.env.SQL_USER!,
      "RDS_PASSWORD": process.env.SQL_PASSWORD!,
      "RDS_DATABASE": process.env.SQL_DB!,
      "RDS_HOST": process.env.SQL_ENDPOINT!
    }

    // generic default handler for any API function that doesn't get its own Lambda method
    // Basically: This lambda functions runs for any request that aren't properly hooked up 
    const default_fn = new lambdaNodejs.NodejsFunction(this, 'LambdaDefaultFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'default.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'default')),
      vpc: vpc,
      securityGroups: [securityGroup],
      timeout: Duration.seconds(3),
    })

    const api_endpoint = new apigw.LambdaRestApi(this, `donazionAPI`, {
      handler: default_fn,
      restApiName: `donazionAPI`, 
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
      },
    })

    // Create a resource (e.g., '/calc')
    const mainResource = api_endpoint.root.addResource('api')
    const exampleResource = mainResource.addResource('example')
    const addCatResource = mainResource.addResource('addCat')
    const dc_showdashboard = mainResource.addResource('dcShowDash')

    // Add a POST method to the '/api/example' resource
    const example_lambda_fnc = new lambdaNodejs.NodejsFunction(this, 'ExampleFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'example', 'example.mts'),
      vpc: vpc,
      environment: db_env,
      securityGroups: [securityGroup],
      timeout: Duration.seconds(3),
    })

    const addCat_fcn = new lambdaNodejs.NodejsFunction(this, 'addCategory', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'addCategory', 'addCatLambda.mjs'),
      vpc: vpc,
      environment: db_env,
      securityGroups: [securityGroup],
      timeout: Duration.seconds(3),
    })

    const showdc_dashboard_fcn = new lambdaNodejs.NodejsFunction(this, 'dc_showdashboard', {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: 'handler',
      entry: path.join(__dirname, 'dc_showdashboard', 'dc_showdashboard.mts'),
      vpc: vpc,
      environment: db_env,
      securityGroups: [securityGroup],
      timeout: Duration.seconds(3)
    })
    
    //Authentication user protocals
    const auth = new apigw.CognitoUserPoolsAuthorizer(this, 'DonazionUserAuthorizer', {
      cognitoUserPools: [props.userPool]
    })
    

    //Adding method to lambda
    exampleResource.addMethod('POST', new apigw.LambdaIntegration(example_lambda_fnc), {
      authorizer: auth,
      authorizationType: apigw.AuthorizationType.COGNITO
    })

    addCatResource.addMethod('POST', new apigw.LambdaIntegration(addCat_fcn), {
      authorizer: auth,
      authorizationType: apigw.AuthorizationType.COGNITO
    })

    dc_showdashboard.addMethod('POST', new apigw.LambdaIntegration(showdc_dashboard_fcn), {
      authorizer: auth,
      authorizationType: apigw.AuthorizationType.COGNITO
    })
  }
}
