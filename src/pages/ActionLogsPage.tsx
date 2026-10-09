import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { logsApi } from '../api/resources'
import { PageHeader } from '../components/Layout'
import { Badge, Card, EmptyState, ErrorNote, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { formatDateTime, plural } from '../lib/format'
import type { ActionLog, Outcome } from '../lib/types'

const PAGE_SIZE = 12

// The actions the API records, grouped the way they appear in the filter
const ACTIONS = [
  'auth:login',
  'auth:register',
  'user:create',
  'user:delete',
  'role:assign',
  'role:create',
  'role:update',
  'role:delete',
  'college:create',
  'college:update',
  'college:delete',
  'review:create',
  'review:update',
  'review:delete',
]

const OUTCOME_TONE: Record<Outcome, 'good' | 'bad' | 'warn'> = { success: 'good', denied: 'bad', failed: 'warn' }

// "role: teacher · reason: You may only create users with the student role"
function describeDetails(details: ActionLog['details']) {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') || 'none' : String(value)}`)
    .join(' · ')
}

export function ActionLogsPage() {
  const [outcome, setOutcome] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['logs', { outcome, action, page }],
    queryFn: () => logsApi.list({ outcome, action, page, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const logs = query.data?.data.logs ?? []
  const total = query.data?.meta?.total

  return (
    <>
      <PageHeader title="Action logs" subtitle={total === undefined ? 'Who did what, and what was refused' : `${plural(total, 'entry').replace('entrys', 'entries')} · newest first · read-only`} />

      <div className="mb-5 grid gap-3 sm:grid-cols-[12rem_14rem]">
        <Select
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by outcome"
        >
          <option value="">Any outcome</option>
          <option value="success">Success</option>
          <option value="denied">Denied (not allowed)</option>
          <option value="failed">Failed login</option>
        </Select>
        <Select
          value={action}
          onChange={(event) => {
            setAction(event.target.value)
            setPage(1)
          }}
          aria-label="Filter by action"
        >
          <option value="">Any action</option>
          {ACTIONS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <Spinner label="Loading the log" />
      ) : query.isError ? (
        <ErrorNote>{errorMessage(query.error)}</ErrorNote>
      ) : logs.length === 0 ? (
        <EmptyState title="Nothing recorded">{outcome || action ? 'No entries match these filters.' : 'Entries appear here as people use the system.'}</EmptyState>
      ) : (
        <>
          <Card className={`overflow-x-auto p-2 transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="text-xs text-zinc-500">
                  {['When', 'Who', 'Action', 'Outcome', 'Details'].map((heading) => (
                    <th key={heading} scope="col" className="px-4 py-3 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id} className="border-t border-zinc-200/80 align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">{log.actor.username ?? <span className="font-normal text-zinc-500">Not logged in</span>}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold">{log.action}</span>
                      <span className="block text-xs text-zinc-500">
                        {log.method} · {log.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={OUTCOME_TONE[log.outcome]}>
                        <span className="capitalize">{log.outcome}</span>
                      </Badge>
                    </td>
                    <td className="max-w-md px-4 py-3 text-xs leading-relaxed break-words text-zinc-600">{describeDetails(log.details) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination meta={query.data?.meta} onPage={setPage} />
        </>
      )}
    </>
  )
}
