import { access, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

const path = new URL('../amplify_outputs.json', import.meta.url);

try {
  await access(path);
} catch {
  const localOutputs = {
    auth: {
      aws_region: 'ap-northeast-1',
      user_pool_id: 'ap-northeast-1_local',
      user_pool_client_id: 'localclient',
      username_attributes: ['username'],
      standard_required_attributes: [],
      user_verification_types: [],
      groups: [{ Students: { precedence: 1 } }, { Admins: { precedence: 0 } }],
      mfa_configuration: 'NONE',
      mfa_methods: [],
      unauthenticated_identities_enabled: false,
    },
    custom: {
      apiUrl: 'http://localhost:3001/prod/',
    },
    version: '1.4',
  };
  await writeFile(path, `${JSON.stringify(localOutputs, null, 2)}\n`, { mode: 0o600 });
}
