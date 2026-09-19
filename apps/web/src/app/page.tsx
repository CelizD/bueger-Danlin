const ingredients = [
  "Lechuga",
  "Tomate",
  "Cebolla caramelizada",
  "Cebolla blanca",
  "Queso",
  "Tocino",
  "Ketchup",
  "Mostaza",
];

const extras = [
  ["Carne extra", 30],
  ["Queso extra", 10],
  ["Tocino extra", 15],
  ["Papas extra", 25],
  ["Coca-Cola lata", 30],
] as const;

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">MVP · desarrollo local</p>
        <h1>Tu hamburguesa, a tu gusto.</h1>
        <p className="lead">
          Combo hamburguesa + papas por <strong>$130 MXN</strong>. Entrega el sábado a las 9:30 a. m. en Universidad.
        </p>
      </section>

      <section className="panel">
        <div>
          <p className="label">Incluidos</p>
          <div className="chips">
            {ingredients.map((ingredient) => (
              <span className="chip" key={ingredient}>{ingredient}</span>
            ))}
          </div>
        </div>

        <div>
          <p className="label">Extras</p>
          <ul className="extras">
            {extras.map(([name, price]) => (
              <li key={name}>
                <span>{name}</span>
                <strong>+{"$"}{price}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="note">Máximo 50 combos. Pedidos cierran el viernes a las 9:00 p. m.</p>
    </main>
  );
}
