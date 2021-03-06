#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';

import { GraplCdkStack } from '../lib/grapl-cdk-stack';
import { EngagementUx } from '../lib/engagement';
import { DeploymentParameters } from './deployment_parameters';

const app = new cdk.App();

const grapl = new GraplCdkStack(app, 'Grapl', {
    version: DeploymentParameters.graplVersion,
    stackName: DeploymentParameters.stackName,
    watchfulEmail: DeploymentParameters.watchfulEmail,
    operationalAlarmsEmail: DeploymentParameters.operationalAlarmsEmail,
    securityAlarmsEmail: DeploymentParameters.securityAlarmsEmail,
    dgraphInstanceType: DeploymentParameters.dgraphInstanceType,
    tags: { 'grapl deployment': DeploymentParameters.stackName },
    description: 'Grapl base deployment',
    env: { 'region': DeploymentParameters.region },
});

new EngagementUx(app, 'EngagementUX', {
    prefix: grapl.prefix,
    edgeApi: grapl.edgeApiGateway,
    stackName: DeploymentParameters.stackName + '-EngagementUX',
    description: 'Grapl Engagement UX',
    env: { 'region': DeploymentParameters.region },
});
