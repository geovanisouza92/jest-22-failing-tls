This example shows a bug that started ocurring in jest from version 22.

To see the problem:

- Clone the repo;
- `npm install` or `yarn`;
- `npm test` or `yarn test`;

The possible workaround involves using something like `cross-env`. See `package.json`'s `test-workaround` script.
