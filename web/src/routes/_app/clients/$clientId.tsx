import { createFileRoute } from '@tanstack/react-router';
import { ClientDetail } from '@/components/clients/detail/ClientDetail';

export const Route = createFileRoute('/_app/clients/$clientId')({
  component: ClientDetailRoute,
});

function ClientDetailRoute() {
  const { clientId } = Route.useParams();
  return <ClientDetail clientId={clientId} />;
}
