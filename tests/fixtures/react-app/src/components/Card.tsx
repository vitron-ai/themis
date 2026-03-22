export interface CardProps {
  title: string;
  children?: unknown;
}

export default function Card({ title, children }: CardProps) {
  return (
    <section data-card="yes">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
