import { GraphQLBoolean, GraphQLFieldConfigMap, GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLOutputType, GraphQLString, GraphQLUnionType } from "graphql";
import { RawNode } from "./dgraph_client";
import { Schema, SchemaProperty } from "./schema_client";
import { RiskType } from "./schema";

type ResolutionMap = Map<string, GraphQLObjectType>;

function propertyToGraphql(property: SchemaProperty, typeMap: ResolutionMap): GraphQLOutputType {
    if (typeMap.size == 0) {
        throw new Error("We expect to only execute this function once the ResolutionMap is full");
    }

    let prim: GraphQLOutputType = undefined;
    if (property.name == "uid") {
        // Special case
        return GraphQLInt;
    }

    if (property.primitive == "Int") {
        prim = GraphQLInt;
    } else if (property.primitive == "Bool") {
        prim = GraphQLBoolean;
    } else if (property.primitive == "Str") {
        prim = GraphQLString;
    } else {
        if (typeMap.has(property.primitive)) {
            prim = typeMap.get(property.primitive)
        } else {
            throw new Error(`Couldn't resolve property ${property.name}: ${property.primitive}`);
        }
    }

    if (property.is_set) {
        return GraphQLList(prim);
    } else {
        return prim;
    }
}

function normalizePropName(name: string): string {
    const regex = /^[_a-zA-Z][_a-zA-Z0-9]*$/;
    if (name == "dgraph.type") {
        return "dgraph_type";
    } else if (name.match(regex).length == 0) {
        throw new Error(`Property name ${name} must be normalized`);
    }
    return name;
}

function schemaToGraphql(schema: Schema, typeMap: ResolutionMap): GraphQLObjectType {
    // Convert one Schema, like "Asset" or "Process"
    return new GraphQLObjectType({
        name: schema.node_type,
        fields: () => {
            const fields: GraphQLFieldConfigMap<any, any> = {};
            for (const prop of schema.type_definition.properties) {
                const propName = normalizePropName(prop.name);
                try { 
                    const propAsGraphql = propertyToGraphql(prop, typeMap);
                    fields[propName] = { type: propAsGraphql };
                } catch (e) {
                    throw new Error(`Couldn't convert ${schema.node_type}: ${e}`);
                }
            }
            return fields
        },
    });
}

function genResolveTypeForTypes(types: ResolutionMap) {
    // Convert an entire set of schemas, for a deployment
    function resolveType(data: RawNode): string  {
        const dgraphType = data.dgraph_type.filter(
            (t: string) => t !== "Entity" && t !== "Base"
        );

        const mostConcreteType = dgraphType[0];
        if (types.has(mostConcreteType)) {
            return mostConcreteType;
        }
        throw new Error(`Couldn't resolve dgraph_type: ${dgraphType}`);
    }
    return resolveType;
}

export function dynamodbSchemasIntoGraphqlTypes(schemas: Schema[]): ResolutionMap {
    const map: ResolutionMap = new Map();
    map.set("Risk", RiskType);

    for (const schema of schemas) {
        const convertedSchema = schemaToGraphql(schema, map);
        if (map.has(convertedSchema.name)) {
            throw new Error(`Two duplicate types with name ${convertedSchema.name}`);
        }
        map.set(convertedSchema.name, convertedSchema);
    }

    return map;
}

export function allSchemasToGraphql(schemas: Schema[]): GraphQLUnionType {
    //const types = schemas.map(schemaToGraphql);
    if (schemas.length == 0) {
        throw new Error("No schemas received");
    }
    const typeMap = dynamodbSchemasIntoGraphqlTypes(schemas);
    if (typeMap.size <= 1) { 
        throw new Error("Seemingly didn't generate types");
    }
    const resolveType = genResolveTypeForTypes(typeMap);
    const GraplEntityType = new GraphQLUnionType({
        name: "GraplEntityType",
        types: Array.from(typeMap.values()),
        resolveType: resolveType,
    });
    return GraplEntityType;
}