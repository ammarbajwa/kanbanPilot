export function EventMessage({ message }: { message: string }) {
  if (message.length <= 240) return <p>{message}</p>;
  return (
    <details className="event-message">
      <summary>View details</summary>
      <p>{message}</p>
    </details>
  );
}
