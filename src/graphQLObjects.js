import {
    GraphQLObjectType,
    GraphQLString,
    GraphQLNonNull,
    GraphQLFloat,
    GraphQLInt
} from 'graphql';

export const UserType = new GraphQLObjectType({
    name: 'User',
    description: 'This represents a users credentials',
    fields: () => ({
        email: { type: GraphQLString },
        username: { type: GraphQLString },
        password: { type: GraphQLString }
    })
});

export const LocationType = new GraphQLObjectType({
    name: 'Location',
    description: 'This represents a location added by the user',
    fields: () => ({
        user_id: { type: GraphQLString },
        name: { type: GraphQLString },
        location: { type: PointType },
        elevation: { type: GraphQLNonNull(GraphQLInt) },
        average_temperature: { type: GraphQLNonNull(GraphQLFloat) },
        kopen_climate: { type: GraphQLString },
        zone_description: { type: GraphQLString }
    })
});

export const PointType = new GraphQLObjectType({
    name: 'Coordinate Point',
    description: 'This represents a single Coordinate',
    fields: () => ({
        latitude: { type: GraphQLNonNull(GraphQLFloat) },
        longitude: { type: GraphQLNonNull(GraphQLFloat) }
    })
});