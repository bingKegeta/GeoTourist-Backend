import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { createHandler } from 'graphql-http/lib/use/express';
import { AddUser, FindUser, QueryUsers, FindUsersByField, Login } from './users.js';
import {
    GraphQLSchema,
    GraphQLObjectType,
    GraphQLString,
    GraphQLNonNull,
    GraphQLList,
    graphql
} from 'graphql';

const app = express();

const UserType = new GraphQLObjectType({
    name: 'User',
    description: 'This represents a users credentials',
    fields: () => ({
        email: { type: GraphQLString },
        username: { type: GraphQLString },
        password: { type: GraphQLString }
    })
});

const RootQueryType = new GraphQLObjectType({
    name: 'Query',
    description: 'Root Query',
    fields: () => ({
        user: {
            type: UserType,
            description: 'Returns a single specific user depending on their details',
            args: {
                email: { type: GraphQLNonNull(GraphQLString) },
                username: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => FindUser(args.email, args.username, args.password)
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
        }
    })
});

const RootMutationType = new GraphQLObjectType({
    name: 'Mutation',
    description: 'Root Mutation',
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
        }
    })
});

const schema = new GraphQLSchema({
    query: RootQueryType,
    mutation: RootMutationType
});

// graphql-http
app.use('/api', graphqlHTTP({
    schema,
    graphiql: true
}));

// express-graphql, deprecated
// app.use('/graphql', graphqlHTTP({
//     schema: schema,
//     graphiql: true
// }));

app.listen(5000, () => console.log('Server Running'));