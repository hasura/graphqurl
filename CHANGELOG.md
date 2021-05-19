# Graphqurl Changelog

## v1.0.1

### Remove usage of Apollo client

With v1.0, graphqurl removed usage of Apollo Client and instead makes use of light-weight isomorphic HTTP clients which reduced the bundle size from 142 kB to 58 kB, a 56% size reduction. 

### GraphiQL Improvements 

The custom graphiQL now supports graphiQL explorer and graphQL code explorer. 

### Improved Scripting API 

GraphQL queries are no longer parsed before execution. For usage as a node library, v1.0 onwards, a client needs to be created before executing GraphQL operations. You can find a sample script in the [example](example/index.js) directory. 

### CLI changes 
* Deprecates flag `--graphiqlAddress` in favour of the new flag `--graphiqlHost`. 
* Support for multiple queries in files and specify which query to execute  through the newly added flag `--operationName`. 

