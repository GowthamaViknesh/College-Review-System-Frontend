import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { logsApi } from '../api/resources'
import { PageHeader } from '../components/Layout'
import { Badge, Button, Card, EmptyState, ErrorNote, Modal, PAGE_SIZES, PageSizeSelect, Pagination, Select, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { displayName, formatDateTime, plural } from '../lib/format'
import type { ActionLog, Outcome } from '../lib/types'

// The actions the API records, grouped the way they appear in the filter
const ACTIONS = [
  'auth:login',
  'auth:logout',
  'auth:register',
  'auth:password_change',
  'auth:password_reset_request',
  'auth:password_reset',
  'profile:update',
  'user:create',
  'user:update',
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

// The table's columns and how much of its width each takes
const COLUMNS = [
  ['Who', 'w-[14%]'],
  ['Action', 'w-[18%]'],
  ['When', 'w-[17%]'],
  ['Outcome', 'w-[12%]'],
  ['Details', 'w-[29%]'],
  ['Actions', 'w-[10%]'],
]

const OUTCOME_TONE: Record<Outcome, 'good' | 'bad' | 'warn'> = { success: 'good', denied: 'bad', failed: 'warn' }

// "role: teacher · reason: You may only create users with the student role"
function describeDetails(details: ActionLog['details']) {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') || 'none' : String(value)}`)
    .join(' · ')
}

// One labelled value in the entry dialog
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-zinc-500">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  )
}

// Everything recorded about one entry. The table shows a summary; this is the whole of it.
function LogEntryModal({ log, onClose }: { log: ActionLog; onClose: () => void }) {
  const details = Object.entries(log.details)
  return (
    <Modal title="Log entry" onClose={onClose} wide>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
        <Fact label="Who">{log.actor.username ? displayName(log.actor.username) : 'Not logged in'}</Fact>
        <Fact label="User id">{log.actor.id ? <code className="font-mono text-xs">{log.actor.id}</code> : '—'}</Fact>
        <Fact label="Action">
          <code className="font-mono text-xs font-semibold">{log.action}</code>
        </Fact>
        <Fact label="Outcome">
          <Badge tone={OUTCOME_TONE[log.outcome]}>
            <span className="capitalize">{log.outcome}</span>
          </Badge>
        </Fact>
        <Fact label="When">{formatDateTime(log.createdAt)}</Fact>
        <Fact label="Request">
          <code className="font-mono text-xs break-all">
            {log.method} {log.path}
          </code>
        </Fact>
        <Fact label="Response status">{log.statusCode}</Fact>
        <Fact label="Done to">{log.target.type ? <span className="capitalize">{log.target.type}</span> : '—'}</Fact>
        <Fact label="Its id">{log.target.id ? <code className="font-mono text-xs break-all">{log.target.id}</code> : '—'}</Fact>
        <Fact label="From address">{log.ip ?? '—'}</Fact>
        <Fact label="Entry id">
          <code className="font-mono text-xs">{log.logId}</code>
        </Fact>
      </dl>

      <h3 className="mt-6 mb-2 text-sm font-semibold">Details</h3>
      {details.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing more was recorded for this action.</p>
      ) : (
        <dl className="divide-y divide-zinc-200 rounded-2xl bg-panel px-4 text-sm">
          {details.map(([key, value]) => (
            <div key={key} className="grid gap-1 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="font-medium text-zinc-500">{key}</dt>
              <dd className="break-words">{Array.isArray(value) ? value.join(', ') || 'none' : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  )
}

export function ActionLogsPage() {
  const [outcome, setOutcome] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const [viewing, setViewing] = useState<ActionLog | null>(null)

  const query = useQuery({
    queryKey: ['logs', { outcome, action, page, pageSize }],
    queryFn: () => logsApi.list({ outcome, action, page, limit: pageSize }),
    placeholderData: keepPreviousData,
  })

  const logs = query.data?.data.logs ?? []
  const total = query.data?.meta?.total

  return (
    <>
      <PageHeader title="Action logs" subtitle={total === undefined ? 'Who did what, and what was refused' : `${plural(total, 'entry').replace('entrys', 'entries')} · newest first · read-only`} />

      {/* The filters sit on the right, under the search box in the header */}
      <div className="mb-5 flex flex-wrap justify-end gap-3">
        <Select
          className="sm:!w-48"
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
          className="sm:!w-64"
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
        <PageSizeSelect
          what="Entries"
          className="sm:!w-40"
          value={pageSize}
          onChange={(size) => {
            setPageSize(size)
            // Page 3 of 10-a-page is not page 3 of 50-a-page, so start again from the first
            setPage(1)
          }}
        />
      </div>

      {query.isPending ? (
        <Spinner label="Loading the log" />
      ) : query.isError ? (
        <ErrorNote>{errorMessage(query.error)}</ErrorNote>
      ) : logs.length === 0 ? (
        <EmptyState title="Nothing recorded">{outcome || action ? 'No entries match these filters.' : 'Entries appear here as people use the system.'}</EmptyState>
      ) : (
        <>
          <Card className={`relative overflow-x-auto p-2 transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            {/* Each column is as wide as its contents need, so the gaps between them look alike; Details takes the rest and wraps */}
            <table className="w-full min-w-[60rem] table-fixed text-left text-sm">
              <thead>
                <tr className="text-sm text-zinc-700">
                  {COLUMNS.map(([heading, width]) => (
                    <th key={heading} scope="col" className={`${width} px-4 py-3 font-semibold`}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.logId} className="border-t border-zinc-200/80">
                    <td className="truncate px-4 py-3 font-semibold">{log.actor.username ? displayName(log.actor.username) : <span className="font-normal text-zinc-500">Not logged in</span>}</td>
                    <td className="px-4 py-3">
                      <span className="block truncate font-mono text-xs font-semibold">{log.action}</span>
                      <span className="block text-xs text-zinc-500">
                        {log.method} · {log.statusCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-600">{formatDateTime(log.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={OUTCOME_TONE[log.outcome]}>
                        <span className="capitalize">{log.outcome}</span>
                      </Badge>
                    </td>
                    {/* One line here; the View button shows all of it */}
                    <td className="truncate px-4 py-3 text-xs text-zinc-600" title={describeDetails(log.details) || undefined}>
                      {describeDetails(log.details) || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="secondary" size="sm" onClick={() => setViewing(log)} aria-label={`View the full entry: ${log.action} by ${log.actor.username ?? 'someone not logged in'}`}>
                        <Eye className="size-3.5" aria-hidden />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Pagination meta={query.data?.meta} onPage={setPage} always />
        </>
      )}

      {viewing && <LogEntryModal log={viewing} onClose={() => setViewing(null)} />}
    </>
  )
}
