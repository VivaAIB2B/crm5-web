import { inferColumns, type ResultColumn } from './chartModel'

// Presentation only: never fetch extra CRM data or merge rows by customer name.
// The technical identifier and all raw fields remain available for inspection.
export function customerResults(rows: Record<string, unknown>[], supplied?: ResultColumn[], selected?: string[]) {
  const columns = supplied ?? inferColumns(rows)
  if (selected) {
    const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
    const nameFields = ['firstName', 'middleName', 'lastName'].filter(key => selected.includes(key))
    const presented: Record<string, unknown>[] = rows.map(row => {
      const name = (selected.includes('companyName') ? text(row.companyName) : '') || nameFields.map(key => text(row[key])).filter(Boolean).join(' ')
      const code = selected.includes('customerCode') ? text(row.customerCode) : ''
      return { ...row, customerId: row.customer, customer: [...(name ? [name] : []), ...(code ? [code] : []), 'ID ' + String(row.customer)].join(' · ') }
    })
    const id: ResultColumn = { name: 'customerId', label: 'ID cliente', kind: 'categorical', typeFamily: 'Integer' }
    const measure = columns.filter(c => c.name === 'orderCount')
    return { rows: presented, columns: [...selected.flatMap(key => columns.filter(c => c.name === key)), ...measure, id],
      chartColumns: [{ name: 'customer', label: 'Cliente', kind: 'categorical' as const, typeFamily: 'Text' }, ...measure, id], details: true }
  }
  const required = ['customer', 'customerCode', 'firstName', 'middleName', 'lastName', 'companyName']
  if (!required.every(name => columns.some(c => c.name === name))) return { rows, columns, details: false }
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
  const presented: Record<string, unknown>[] = rows.map(row => {
    const name = text(row.companyName) || ['firstName', 'middleName', 'lastName'].map(k => text(row[k])).filter(Boolean).join(' ') || 'Anagrafica non disponibile'
    const code = text(row.customerCode)
    // Always retain ID in the chart label: identical names/codes cannot hide two customers.
    return { ...row, customerId: row.customer, customerName: name,
      customer: `${name} · ${code ? code + ' · ' : ''}ID ${String(row.customer)}` }
  })
  const display: ResultColumn[] = [
    { name: 'customerCode', label: 'Codice cliente', kind: 'categorical', typeFamily: 'Text' },
    { name: 'customerName', label: 'Nome / ragione sociale', kind: 'categorical', typeFamily: 'Text' },
    ...columns.filter(c => !required.includes(c.name)),
    { name: 'customerId', label: 'ID cliente', kind: 'categorical', typeFamily: 'Integer' }
  ]
  const chartColumns: ResultColumn[] = [{ name: 'customer', label: 'Cliente', kind: 'categorical', typeFamily: 'Text' },
    ...display.filter(c => c.name !== 'customerName' && c.name !== 'customerCode')]
  return { rows: presented, columns: display, chartColumns, details: true }
}

