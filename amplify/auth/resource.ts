import { defineAuth } from '@aws-amplify/backend';

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  groups: ['Admins', 'Students'],
  accountRecovery: 'NONE',
});
