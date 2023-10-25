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
            description: 'A single specific user',
            args: {
                email: { type: GraphQLNonNull(GraphQLString) },
                username: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => FindUser(args.email, args.username, args.password)
        },
        users: {
            type: new GraphQLList(UserType),
            description: 'List of All Users',
            resolve: () => QueryUsers()
        },
        userByField: {
            type: new GraphQLList(UserType),
            description: 'Finds users with the specified fields',
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
            description: 'Add a user',
            args: {
                email: { type: GraphQLNonNull(GraphQLString) },
                username: { type: GraphQLNonNull(GraphQLString) },
                password: { type: GraphQLNonNull(GraphQLString) }
            },
            resolve: (parent, args) => AddUser(args.email, args.username, args.password)
        },
        login: {
            type: GraphQLString, // You can use a String for returning a token or a session
            description: 'User login',
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