## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript repository for Identity Reconciliation.

Node Version 18.15.0

[HOSTED URL] (http://3.110.107.44:3000/contacts/identify)

```curl
curl --location 'http://3.110.107.44:3000/contacts/identify' \
--header 'Content-Type: application/json' \
--header 'X-API-Key: {{token}}' \
--data-raw '{
    "email": "hammad@gmail.com",
    "phoneNumber": "7065"
}'
```
## Tech Stack

NestJs
MySQL

## Installation

```bash
$ yarn install
```

## Running the app

Create a .env file in the root folder (Take reference from .env.example file)

```bash
# development
$ yarn run start

# watch mode
$ yarn run start:dev

# production mode
$ yarn run start:prod
```
