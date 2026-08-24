export function MessageBody({ body, me }: { body: string; me: string }) {
  const parts = body.split(/(@everyone|@[a-z0-9_.]+)/gi);
  return <p>{parts.map((part, index) => {
    const mention = /^@(everyone|[a-z0-9_.]+)$/i.test(part);
    const mine = part.toLowerCase() === `@${me.toLowerCase()}`;
    return mention ? <mark className={`message-mention ${mine ? "mine" : ""}`} key={`${part}-${index}`}>{part}</mark> : part;
  })}</p>;
}
