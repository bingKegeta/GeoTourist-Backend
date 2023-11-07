import {
    GraphQLObjectType,
    GraphQLString,
    GraphQLNonNull,
    GraphQLFloat,
    GraphQLInt,
    GraphQLInputObjectType,
    GraphQLList
} from 'graphql';

export const UserType = new GraphQLObjectType({
    name: 'User',
    description: 'This represents a users credentials',
    fields: () => ({
        _id: { type: GraphQLString },
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
        name: { type: LocationNameType },
        location: { type: PointType },
        elevation: { type: GraphQLInt },
        avg_temp: { type: GraphQLFloat },
        trewartha: { type: GraphQLString },
        climate_zone: { type: GraphQLString }
    })
});

export const PointType = new GraphQLObjectType({
    name: 'Coordinate',
    description: 'This represents a single Coordinate',
    fields: () => ({
        latitude: { type: GraphQLNonNull(GraphQLFloat) },
        longitude: { type: GraphQLNonNull(GraphQLFloat) }
    })
});

export const PointInputType = new GraphQLInputObjectType({
    name: 'CoordinateInput',
    description: 'This represents a single Coordinate Input',
    fields: () => ({
        latitude: { type: GraphQLNonNull(GraphQLFloat) },
        longitude: { type: GraphQLNonNull(GraphQLFloat) }
    })
});

export const LocationUpdateInputType = new GraphQLInputObjectType({
    name: 'LocationInput',
    description: 'This is used for updating a Location',
    fields: () => ({
        name: { type: GraphQLString },
        location: { type: PointInputType }
    })
});

export const LocationNameType = new GraphQLObjectType({
    name: 'Address',
    description: 'This represents the full address of the location',
    fields: () => ({
        display: { type: GraphQLNonNull(GraphQLString) },
        street: { type: GraphQLString },
        city: { type: GraphQLString },
        country: { type: GraphQLNonNull(GraphQLString) },
        address: { type: GraphQLString },
        postal: { type: GraphQLString }
    })
});

export const LocationNameInputType = new GraphQLInputObjectType({
    name: 'LocationNameInput',
    description: 'This is used for adding the detailed name of a location',
    fields: () => ({
        display: { type: GraphQLNonNull(GraphQLString) },
        street: { type: GraphQLString },
        city: { type: GraphQLString },
        country: { type: GraphQLNonNull(GraphQLString) },
        address: { type: GraphQLString },
        postal: { type: GraphQLString }
    })
})