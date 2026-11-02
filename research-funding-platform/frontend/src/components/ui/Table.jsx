import clsx from 'clsx'

/**
 * Generic data table.
 * columns: [{ key, header, render?(row), className?, align?: 'left'|'right'|'center', headerClassName? }]
 */
export default function Table({ columns = [], rows = [], rowKey = 'id', onRowClick, empty, dense = false, className, caption }) {
  const keyOf = (row, index) => (typeof rowKey === 'function' ? rowKey(row, index) : row?.[rowKey] ?? index)
  return (
    // `relative` keeps absolutely positioned descendants (e.g. sr-only headers) inside the scroll area on phones.
    <div className={clsx('relative overflow-x-auto scrollbar-thin', className)}>
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={clsx(
                  'whitespace-nowrap bg-slate-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 first:rounded-tl-lg last:rounded-tr-lg',
                  column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left',
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">
                {empty || 'No records to show.'}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={keyOf(row, index)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter') onRowClick(row)
                      }
                    : undefined
                }
                tabIndex={onRowClick ? 0 : undefined}
                className={clsx(onRowClick && 'cursor-pointer hover:bg-indigo-50/50 focus:bg-indigo-50/50 focus:outline-none')}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      dense ? 'px-3 py-2' : 'px-3 py-3',
                      'align-top text-slate-700',
                      column.align === 'right' ? 'text-right tabular' : column.align === 'center' ? 'text-center' : 'text-left',
                      column.className,
                    )}
                  >
                    {column.render ? column.render(row, index) : row?.[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
