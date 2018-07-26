graphqurl
=========

curl graphql

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/graphqurl.svg)](https://npmjs.org/package/graphqurl)

[![CircleCI](https://circleci.com/gh/hasura/graphqurl/tree/master.svg?style=shield)](https://circleci.com/gh/hasura/graphqurl/tree/master)

[![Appveyor CI](https://ci.appveyor.com/api/projects/status/github/hasura/graphqurl?branch=master&svg=true)](https://ci.appveyor.com/project/hasura/graphqurl/branch/master)
[![Codecov](https://codecov.io/gh/hasura/graphqurl/branch/master/graph/badge.svg)](https://codecov.io/gh/hasura/graphqurl)
[![Downloads/week](https://img.shields.io/npm/dw/graphqurl.svg)](https://npmjs.org/package/graphqurl)
[![License](https://img.shields.io/npm/l/graphqurl.svg)](https://github.com/hasura/graphqurl/blob/master/package.json)

<!-- toc -->
# Usage

```bash
gq \
  --endpoint https://my-graphql-endpoint/graphql \
  -H 'Authorization: token <token>'
  -H 'X-Another-Header: another-header-value'
  'query { table { column } }'
```

# Commands
<!-- commands -->
