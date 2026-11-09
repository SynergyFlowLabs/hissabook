/**
 * Shared skeleton primitives.
 *
 * Every screen draws its real layout while data is in flight instead of showing
 * a blank card or a "Loading…" sentence. A skeleton that matches the shape of
 * what is coming means the page never reflows when the data lands, and the owner
 * can see the structure immediately on a slow phone.
 *
 * Deliberately server-safe and dependency-free: these are plain elements, so
 * they can be used from client screens without pulling anything into the bundle.
 *
 * Styling lives in `app/globals.css` under "Skeleton loaders" and follows the
 * same shimmer as the notification panel, so the whole product breathes at one
 * rhythm. The shimmer stops under `prefers-reduced-motion`.
 */

/** A single shimmering bar. Widths are set by the caller to make ragged text. */
export function Sk({ w, h, dark, radius }: { w?: string | number; h?: number; dark?: boolean; radius?: number }) {
  return (
    <span
      className={`sk ${dark ? 'sk-on-dark' : ''}`.trim()}
      style={{
        width: w === undefined ? undefined : typeof w === 'number' ? `${w}px` : w,
        height: h === undefined ? undefined : `${h}px`,
        borderRadius: radius === undefined ? undefined : `${radius}px`,
      }}
      aria-hidden="true"
    />
  );
}

/** Several text lines; the last one is shorter so it reads as a paragraph. */
export function SkLines({ count = 3, gap }: { count?: number; gap?: number }) {
  const widths = ['100%', '92%', '78%', '86%', '64%'];
  return (
    <span className="sk-stack" style={gap === undefined ? undefined : { gap }} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <span key={index} className="sk sk-line sk-sm" style={{ width: widths[index % widths.length] }} />
      ))}
    </span>
  );
}

/**
 * Rows inside an existing `<tbody>`. The table header is already rendered, so
 * the placeholder has to be a `<tr>` with one `<td>` per column.
 */
export function SkTableRows({ rows = 6, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <tr key={rowIndex} className="sk-row" aria-hidden="true">
          {Array.from({ length: columns }, (_, columnIndex) => (
            // Vary the widths across columns and rows so it reads as data
            // rather than a striped block.
            <td
              key={columnIndex}
              className={
                columnIndex === 0 ? 'sk-narrow'
                  : columnIndex === columns - 1 ? 'sk-amount'
                    : columnIndex % 3 === 0 ? 'sk-tiny'
                      : undefined
              }
            >
              <span className="sk sk-line sk-sm" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A list card: avatar block plus two text lines, repeated. */
export function SkList({ rows = 4, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div className="sk-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="sk-list-row">
          {avatar && <span className="sk sk-avatar" />}
          <span className="sk-stack sk-grow">
            <span className="sk sk-line sk-sm" style={{ width: `${72 - (index % 3) * 9}%` }} />
            <span className="sk sk-line sk-sm" style={{ width: `${46 - (index % 2) * 8}%` }} />
          </span>
          <span className="sk sk-line sk-sm" style={{ width: 52 }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Announced to assistive tech once per region, so "loading" is communicated
 * without making every bar a readable element.
 */
export function SkStatus({ label }: { label: string }) {
  return (
    <span className="sk-status" role="status" aria-live="polite">
      {label}
    </span>
  );
}

/**
 * A screen-level placeholder: the caller supplies its own real topbar and page
 * heading, this fills the body with stat cards and table rows in the final
 * layout. Used by Team, Inventory and Partners so all three settle identically
 * instead of each having its own "Loading …" sentence.
 */
export function SkPageBody({
  stats = 4,
  tableColumns = 6,
  tableRows = 6,
  extra = 'none',
}: {
  stats?: number;
  tableColumns?: number;
  tableRows?: number;
  extra?: 'none' | 'list' | 'two-cards';
}) {
  return (
    <>
      {stats > 0 && (
        <section className="sk-kpi" aria-hidden="true">
          {Array.from({ length: stats }, (_, index) => (
            <div key={index} className="sk-card" style={{ gap: 12 }}>
              <Sk w={index % 2 ? 96 : 118} h={9} />
              <Sk w={`${58 - (index % 3) * 6}%`} h={22} radius={7} />
            </div>
          ))}
        </section>
      )}

      <section className="soft-card" style={{ marginTop: 14 }} aria-hidden="true">
        <div className="card-header-row">
          <span className="sk-stack" style={{ gap: 7 }}>
            <Sk w={168} h={11} />
            <Sk w={244} h={8} />
          </span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <tbody>
              <SkTableRows rows={tableRows} columns={tableColumns} />
            </tbody>
          </table>
        </div>
      </section>

      {extra === 'list' && (
        <section style={{ marginTop: 14 }} aria-hidden="true">
          <SkList rows={3} avatar={false} />
        </section>
      )}
      {extra === 'two-cards' && (
        <section style={{ marginTop: 14, display: 'grid', gap: 14 }} aria-hidden="true">
          <div className="sk-card"><Sk w={140} h={11} /><SkLines count={3} /></div>
          <div className="sk-card"><Sk w={120} h={11} /><SkLines count={2} /></div>
        </section>
      )}
    </>
  );
}
