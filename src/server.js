import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { AddUser, FindUser, QueryUsers, FindUsersByField, Login, FindUserByID } from './users.js';
import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLNonNull,
    GraphQLList,
    GraphQLFloat,
} from 'graphql';
import { DeleteLocation, QueryLocations, QueryLocationsByName, addLocation, UpdateLocation } from './locations.js';
import { UserType, LocationType, LocationUpdateInputType, LocationNameType, LocationNameInputType } from './graphQLObjects.js';
import cors from 'cors';

const app = express();

const RootQueryType = new GraphQLObjectType({
    name: 'Query',
    description: 'All query points',
    fields: () => ({
        user: {
            type: UserType,
            description: 'Returns a single specific user depending on their details',
            args: {
                email: { type: GraphQLNonNull(GraphQLString) },
                username: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => FindUser(args.email, args.username)
        },
        users: {
            type: new GraphQLList(UserType),
            description: 'Returns a list of all the users',
            resolve: () => QueryUsers()
        },
        userByField: {
            type: new GraphQLList(UserType),
            description: 'Returns users matching a partial search from a specific field',
            args: {
                field: { type: GraphQLNonNull(GraphQLString) },
                value: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => FindUsersByField(args.field, args.value)
        },
        userByID: {
            type: UserType,
            description: 'Returns the user document with the given MongoDB Object ID field',
            args: {
                _id: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => FindUserByID(args._id)
        },
        locations: {
            type: new GraphQLList(LocationType),
            description: 'Returns a list of all locations added by a specific user',
            args: {
                user_id: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => QueryLocations(args.user_id)
        },
        locationsByName: {
            type: new GraphQLList(LocationType),
            description: 'This is not working now',
            args: {
                user_id: { type: GraphQLNonNull(GraphQLString) },
                name: { type: GraphQLString }
            },
            resolve: (parent, args) => QueryLocationsByName(args.user_id, args.name)
        }
    })
});

const RootMutationType = new GraphQLObjectType({
    name: 'Mutation',
    description: 'All Mutation points',
    fields: () => ({
        addUser: {
            type: GraphQLString,
            description: 'Add a new non existing user to the users collection of the db',
            args: {
                email: { type: GraphQLNonNull(GraphQLString) },
                username: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => AddUser(args.email, args.username, args.password)
        },
        login: {
            type: GraphQLString, // You can use a String for returning a token or a session
            description: 'Authenticate User Login and return the Object ID on sucessful login',
            args: {
                emailOrUsername: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => Login(args.emailOrUsername, args.password)
        },
        addLocation: {
            type: GraphQLString,
            description: 'Add a new location (won\'t accept any location that is in a 5km radius from an already existing location)',
            args: {
                user_id: { type: GraphQLNonNull(GraphQLString) },
                name: { type: GraphQLNonNull(LocationNameInputType) },
                latitude: { type: GraphQLNonNull(GraphQLFloat) },
                longitude: { type: GraphQLNonNull(GraphQLFloat) },
            },
            resolve: (parent, args) => addLocation(args.user_id, args.name, args.latitude, args.longitude)
        },
        updateLocation: {
            type: LocationType,
            description: 'Update a selected location with new data',
            args: {
                _id: { type: GraphQLString },
                updatedData: { type: LocationUpdateInputType }
            },
            resolve: (parent, args) => UpdateLocation(args._id, args.updatedData)
        },
        deleteLocation: {
            type: GraphQLString,
            description: 'Remove entry based on the Object ID of the selected location',
            args: {
                _id: { type: GraphQLString }
            },
            resolve: (parent, args) => DeleteLocation(args._id)
        }
    })
});

const schema = new GraphQLSchema({
    query: RootQueryType,
    mutation: RootMutationType
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', graphqlHTTP({
    schema,
    graphiql: true
}));

app.listen(5000, () => console.log('Server Running'));