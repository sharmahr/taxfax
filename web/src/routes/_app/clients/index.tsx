import { createFileRoute } from '@tanstack/react-router';
import { usePageTitle } from '@/components/shell';
import { RosterView } from '@/components/clients/roster/RosterView';

export const Route = createFileRoute('/_app/clients/')({
  component: ClientsRoute,
});

function ClientsRoute() {
  usePageTitle('Clients');
  return <RosterView />;
}
