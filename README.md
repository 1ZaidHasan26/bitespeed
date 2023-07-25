## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript repository for Identity Reconciliation.

**Node Version - 18.15.0**

##HOSTED URL

(http://3.110.107.44:3000/contacts/identify)

**Curl example**
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

1. NestJs
2. MySQL

## Installation

```bash
$ npm install -g yarn
$ yarn install
```

## Running the app

1. Create a .env file in the root folder (Take reference from .env.example file)
2. Run this command to run the application

    ```bash
    $ yarn start
    ```
