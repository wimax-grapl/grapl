import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';

export interface SwarmProps {
    // The VPC where the Docker Swarm cluster will live
    readonly vpc: ec2.IVpc;

    // The service-specific (e.g. DGraph) ports to open internally
    // within the Docker Swarm cluster.
    readonly servicePorts: ec2.Port[];
}

export class Swarm extends cdk.Construct {
    constructor(
        scope: cdk.Construct,
        id: string,
        swarmProps: SwarmProps
    ) {
        super(scope, id);

        const bastionSecurityGroup = new ec2.SecurityGroup(scope, id + "-bastion-security-group", {
            vpc: swarmProps.vpc,
            allowAllOutbound: false
        });

        const swarmSecurityGroup = new ec2.SecurityGroup(scope, id + "-swarm-security-group", {
            vpc: swarmProps.vpc,
            allowAllOutbound: false
        });

        // allow hosts in the swarm security group to communicate
        // internally on the following ports:
        //   TCP 22 -- SSH
        //   TCP 2376 -- secure docker client (docker-machine)
        //   TCP 2377 -- inter-node communication (only needed on manager nodes)
        //   TCP + UDP 7946 -- container network discovery
        //   UDP 4789 -- overlay network traffic
        swarmSecurityGroup.connections.allowInternally(ec2.Port.tcp(22));
        swarmSecurityGroup.connections.allowInternally(ec2.Port.tcp(2376));
        swarmSecurityGroup.connections.allowInternally(ec2.Port.tcp(2377));
        swarmSecurityGroup.connections.allowInternally(ec2.Port.tcp(7496));
        swarmSecurityGroup.connections.allowInternally(ec2.Port.udp(7496));
        swarmSecurityGroup.connections.allowInternally(ec2.Port.udp(4789));

        // allow hosts in the swarm security group to communicate
        // internally on the given service ports.
        const servicePorts = swarmProps.servicePorts;
        servicePorts.forEach(
            (port, _) => swarmSecurityGroup.connections.allowInternally(port)
        );

        // allow only the bastion security group to talk to the swarm
        // security group on port 22 (SSH)
        swarmSecurityGroup.connections.allowFrom(
            bastionSecurityGroup,
            ec2.Port.tcp(22)
        );
        bastionSecurityGroup.connections.allowTo(
            swarmSecurityGroup,
            ec2.Port.tcp(22)
        );

        new SwarmBastion(scope, id + '-bastion', {
            vpc: swarmProps.vpc,
            securityGroup: bastionSecurityGroup,
            instanceType: new ec2.InstanceType("t3.nano")
        });

        new SwarmJumpPoint(scope, id + '-jump-point', {
            vpc: swarmProps.vpc,
            instanceType: new ec2.InstanceType("t3.nano"),
            machineImage: new ec2.AmazonLinuxImage(),
            securityGroup: swarmSecurityGroup
        });
    }
}

class SwarmBastion extends cdk.Construct {
    constructor(
        scope: cdk.Construct,
        id: string,
        bastion_props: ec2.BastionHostLinuxProps
    ) {
        super(scope, id);

        new ec2.BastionHostLinux(scope, id, bastion_props);
    }
}

class SwarmJumpPoint extends cdk.Construct {
    constructor(
        scope: cdk.Construct,
        id: string,
        instance_props: ec2.InstanceProps
    ) {
        super(scope, id);

        new ec2.Instance(scope, id, instance_props);
    }
}