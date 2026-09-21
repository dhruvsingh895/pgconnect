import { AuthScreen } from '@/features/auth/auth-screen';
import { config } from '@/server/config';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  return (
    <AuthScreen
      demoEnabled={config.demo}
      smsEnabled={Boolean(config.sms.accountSid && config.sms.authToken && config.sms.from)}
      invite={typeof invite === 'string' ? invite : undefined}
    />
  );
}
