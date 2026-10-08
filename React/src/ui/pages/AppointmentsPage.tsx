import { useCallback, useMemo, useRef } from 'react';
import { ScheduleComponent, ViewsDirective, ViewDirective, Inject, Day, Week, WorkWeek, Month, Agenda } from '@syncfusion/ej2-react-schedule';
import type { ActionEventArgs, PopupOpenEventArgs } from '@syncfusion/ej2-react-schedule';
import { ButtonComponent } from '@syncfusion/ej2-react-buttons';
import { CalendarPlus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useNotifier } from '../components/useNotifier';
import { useSalesData, useSalesStore } from '../../state/SalesStore';
import { parseLocal, toLocalIso } from '../../domain/dates';
import { fullName } from '../../domain/selectors';
import { deleteAppointment, upsertAppointment } from '../../domain/commands';
import type { Result } from '../../domain/commands';
import type { Appointment, SalesData } from '../../domain/types';
import { timeZoneName } from '../format';

// Demo user: the Sales Manager (Bob Jones). The calendar shows and edits their appointments only.
const DEMO_USER_ID = 1;

interface ScheduleEvent {
  id?: number; subject?: string; location?: string | null; description?: string | null; start: Date; end: Date; isAllDay?: boolean;
  recurrenceRule?: string | null; recurrenceException?: string | null; recurrenceId?: number | null;
}
const CRUD = new Set(['eventCreate', 'eventChange', 'eventRemove']);

const toAppointment = (e: ScheduleEvent, isNew: boolean): Appointment => ({
  id: isNew ? -1 : Number(e.id), employeeId: DEMO_USER_ID, subject: (e.subject ?? '').trim(), location: e.location || null,
  startTime: toLocalIso(e.start), endTime: toLocalIso(e.end), isAllDay: !!e.isAllDay, description: e.description || null,
  recurrenceRule: e.recurrenceRule || null, recurrenceException: e.recurrenceException || null, recurrenceId: e.recurrenceId ?? null,
});

/** Applies one Schedule save as a single store change, so a series edit and its exceptions land together or not at all. */
function applyScheduleChange(added: ScheduleEvent[], changed: ScheduleEvent[], deleted: ScheduleEvent[]) {
  return (data: SalesData): Result<string> => {
    let current = data;
    for (const e of deleted) { const r = deleteAppointment(current, Number(e.id)); if (!r.ok) return r; current = r.data; }
    for (const e of changed) { const r = upsertAppointment(current, toAppointment(e, false)); if (!r.ok) return r; current = r.data; }
    let subject = changed[0]?.subject ?? deleted[0]?.subject ?? '';
    for (const e of added) { const r = upsertAppointment(current, toAppointment(e, true)); if (!r.ok) return r; current = r.data; subject = r.value.subject; }
    return { ok: true, data: current, value: subject || 'Appointment' };
  };
}

const VERB: Record<string, string> = { eventCreate: 'added', eventChange: 'updated', eventRemove: 'deleted' };

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
// Module-level event template for the time-grid views: short events show only the subject so it is never clipped.
const timeGridEvent = (e: ScheduleEvent) => {
  const minutes = (e.end.getTime() - e.start.getTime()) / 60000;
  return (
    <div className="appt">
      <div className="appt-subject">{e.subject}</div>
      {minutes >= 45 && <div className="appt-meta">{timeFmt.format(e.start)} – {timeFmt.format(e.end)}</div>}
      {minutes >= 75 && e.location && <div className="appt-meta">{e.location}</div>}
    </div>
  );
};

export function AppointmentsPage() {
  const data = useSalesData();
  const { clock, run } = useSalesStore();
  const schedule = useRef<ScheduleComponent>(null);
  const { notify, host } = useNotifier();
  const user = data.employees.find((e) => e.id === DEMO_USER_ID);
  const events = useMemo(() => data.appointments
    .filter((a) => a.employeeId === DEMO_USER_ID)
    .map((a) => ({ ...a, start: parseLocal(a.startTime), end: parseLocal(a.endTime) })), [data.appointments]);

  // The store is the single source of truth: the Schedule's own write is cancelled and the
  // validated change is committed to the session store, which re-renders the calendar.
  const actionBegin = useCallback((args: ActionEventArgs) => {
    if (!args.requestType || !CRUD.has(args.requestType)) return;
    args.cancel = true;
    const result = run(applyScheduleChange(
      (args.addedRecords ?? []) as ScheduleEvent[], (args.changedRecords ?? []) as ScheduleEvent[], (args.deletedRecords ?? []) as ScheduleEvent[]));
    if (result.ok) notify(`Appointment ${VERB[args.requestType]}`, `"${result.value}" was ${VERB[args.requestType]}.`, 'success');
    else notify('Appointment not saved', result.errors.map((e) => e.message).join(' '), 'danger');
  }, [run, notify]);

  const newAppointment = () => {
    const start = clock.now();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    // Outside working hours (08:00-18:00) the next hour can fall past the visible day, so offer 09:00 instead.
    if (start.getHours() >= 18) start.setDate(start.getDate() + 1);
    if (start.getHours() >= 18 || start.getHours() < 8) start.setHours(9);
    schedule.current?.openEditor({ startTime: start, endTime: new Date(start.getTime() + 3600000), isAllDay: false }, 'Add');
  };

  return (
    <>
      <PageHeader title="Appointments" description={`${user ? fullName(user) : 'Demo user'}'s calendar, times shown in ${timeZoneName()}. Double-click a slot or an appointment to add or edit.`}
        actions={<ButtonComponent cssClass="e-primary" onClick={newAppointment}><CalendarPlus size={16} aria-hidden="true" /><span className="btn-text">New appointment</span></ButtonComponent>} />
      <div className="surface schedule-host">
        <ScheduleComponent id="appointments" ref={schedule} height="680px" selectedDate={clock.now()} currentView="Week"
          startHour="07:00" endHour="20:00" workHours={{ highlight: true, start: '08:00', end: '18:00' }} actionBegin={actionBegin}
          popupOpen={(args: PopupOpenEventArgs) => {
            // Match the page's wording: the editor is "New appointment" / "Edit appointment", not "New Event".
            if (args.type !== 'Editor') return;
            const title = args.element.querySelector('.e-title-text');
            if (title) title.textContent = (args.data as ScheduleEvent | undefined)?.id ? 'Edit appointment' : 'New appointment';
          }}
          eventSettings={{
            dataSource: events,
            fields: {
              id: 'id', subject: { name: 'subject', title: 'Subject', validation: { required: true } }, location: { name: 'location' }, description: { name: 'description' },
              startTime: { name: 'start' }, endTime: { name: 'end' }, isAllDay: { name: 'isAllDay' },
              recurrenceRule: { name: 'recurrenceRule' }, recurrenceException: { name: 'recurrenceException' }, recurrenceID: { name: 'recurrenceId' },
            },
          }}>
          <ViewsDirective>
            <ViewDirective option="Day" eventTemplate={timeGridEvent as never} />
            <ViewDirective option="Week" eventTemplate={timeGridEvent as never} />
            <ViewDirective option="WorkWeek" eventTemplate={timeGridEvent as never} />
            <ViewDirective option="Month" />
            <ViewDirective option="Agenda" />
          </ViewsDirective>
          <Inject services={[Day, Week, WorkWeek, Month, Agenda]} />
        </ScheduleComponent>
      </div>
      {host}
    </>
  );
}
