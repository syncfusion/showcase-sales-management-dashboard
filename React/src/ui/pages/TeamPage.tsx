import { useCallback, useMemo, useRef } from 'react';
import {
  GridComponent, ColumnsDirective, ColumnDirective, Inject, Sort, Toolbar, Search, Page, Edit, ForeignKey, ExcelExport, PdfExport,
} from '@syncfusion/ej2-react-grids';
import type { ActionEventArgs, Column } from '@syncfusion/ej2-react-grids';
import type { ClickEventArgs } from '@syncfusion/ej2-navigations';
import { PageHeader } from '../components/PageHeader';
import { useNotifier } from '../components/useNotifier';
import { useSalesData, useSalesStore } from '../../state/SalesStore';
import { fullName } from '../../domain/selectors';
import { parseLocal, toLocalIso } from '../../domain/dates';
import { deleteEmployee, upsertEmployee } from '../../domain/commands';
import type { Employee } from '../../domain/types';
import { assetUrl } from '../../basePath';
import { useMediaQuery } from '../useMediaQuery';

interface TeamRow {
  id: number; photoUrl: string; firstName: string; lastName: string; jobTitleId: number; gender: 'Male' | 'Female';
  email: string; dob: Date; reportsToId: number | null; imagePath: string; reportsToName: string;
}
// Module-level templates reading only row fields.
const photoTemplate = (r: TeamRow) => <img className="avatar" src={r.photoUrl} alt="" />;
const reportsToTemplate = (r: TeamRow) => <span>{r.reportsToName || '—'}</span>;
// The grid's dropdown editor projects its list onto the column field, so options use the same key.
const GENDERS = [{ gender: 'Female' }, { gender: 'Male' }];
const required = { required: true };
// Exports list the business columns only (the photo column is an image template).
// The export API types columns as Column instances, but plain column models are what it reads.
const EXPORT_COLUMNS = [
  { field: 'firstName', headerText: 'First name', width: 110 }, { field: 'lastName', headerText: 'Last name', width: 110 },
  { field: 'designation', headerText: 'Designation', width: 130 }, { field: 'gender', headerText: 'Gender', width: 80 },
  { field: 'email', headerText: 'Email', width: 220 }, { field: 'dobText', headerText: 'Date of birth', width: 110 },
  { field: 'reportsTo', headerText: 'Reports to', width: 140 },
] as unknown as Column[];

export function TeamPage() {
  const data = useSalesData();
  const { run } = useSalesStore();
  const grid = useRef<GridComponent>(null);
  const { notify, host } = useNotifier();
  const phone = useMediaQuery('(max-width: 599px)');
  const rows = useMemo<TeamRow[]>(() => {
    const byId = new Map(data.employees.map((e) => [e.id, e]));
    return data.employees.map((e) => ({
      id: e.id, photoUrl: assetUrl(e.imagePath), imagePath: e.imagePath, firstName: e.firstName, lastName: e.lastName, jobTitleId: e.jobTitleId,
      gender: e.gender, email: e.email, dob: parseLocal(e.dateOfBirth), reportsToId: e.reportsToId,
      reportsToName: e.reportsToId && byId.get(e.reportsToId) ? fullName(byId.get(e.reportsToId)!) : '',
    }));
  }, [data.employees]);
  // Edit and Delete act on the selected row, so they stay disabled until one is selected.
  const syncToolbar = () => {
    const g = grid.current;
    g?.toolbarModule?.enableItems(['team-grid_edit', 'team-grid_delete'], (g.getSelectedRecords()?.length ?? 0) > 0);
  };
  // Only a Sales Manager or Team Leader can be a manager; the editor offers just those.
  const managers = useMemo(() => {
    const leadTitles = new Set(data.jobTitles.filter((j) => j.code !== 'SR').map((j) => j.id));
    return data.employees.filter((e) => leadTitles.has(e.jobTitleId)).map((e) => ({ id: e.id, name: fullName(e) }));
  }, [data.employees, data.jobTitles]);
  const srTitleId = data.jobTitles.find((j) => j.code === 'SR')?.id;

  const actionBegin = useCallback((args: ActionEventArgs) => {
    if (args.requestType === 'save') {
      const r = args.data as TeamRow;
      const isNew = args.action === 'add';
      const gender = r.gender === 'Male' ? 'Male' : 'Female';
      const employee: Employee = {
        id: isNew ? -1 : r.id, firstName: r.firstName ?? '', lastName: r.lastName ?? '', email: (r.email ?? '').trim(), gender: r.gender ?? (undefined as never),
        dateOfBirth: r.dob ? toLocalIso(new Date(r.dob)).slice(0, 10) : '1990-01-01', reportsToId: r.reportsToId ? Number(r.reportsToId) : null,
        jobTitleId: Number(r.jobTitleId), imagePath: isNew || !r.imagePath ? `images/profile/${gender}Default.jpg` : r.imagePath,
      };
      const result = run((d) => upsertEmployee(d, employee));
      if (!result.ok) {
        args.cancel = true;
        notify(isNew ? 'Employee not added' : 'Changes not saved', result.errors.map((e) => e.message).join(' '), 'danger');
        return;
      }
      (args.data as TeamRow).id = result.value.id;
      notify(isNew ? 'Employee added' : 'Employee updated', `${fullName(result.value)} was ${isNew ? 'added to' : 'updated in'} the team.`, 'success');
    } else if (args.requestType === 'delete') {
      const r = (args.data as TeamRow[])[0];
      if (!r) return;
      const result = run((d) => deleteEmployee(d, r.id));
      if (!result.ok) {
        args.cancel = true;
        notify(`${r.firstName} ${r.lastName} can't be deleted`, result.errors.map((e) => e.message).join(' '), 'danger');
        return;
      }
      notify('Employee deleted', `${r.firstName} ${r.lastName} was removed from the team.`, 'success');
    }
  }, [run, notify]);

  // The dialog editor lists every visible column; the photo is a display-only template, so hide its empty field.
  // (Hidden, not removed: the grid tears this form down itself when the dialog closes.)
  const actionComplete = (args: ActionEventArgs) => {
    if (args.requestType !== 'add' && args.requestType !== 'beginEdit') return;
    const { form, dialog } = args as ActionEventArgs & { form?: HTMLFormElement; dialog?: { header: string } };
    const row = form?.querySelector('input[name=""], input:not([name])')?.closest('tr');
    if (row) row.hidden = true;
    if (dialog) dialog.header = args.requestType === 'add' ? 'Add employee' : 'Edit employee';
  };

  const toolbarClick = (args: ClickEventArgs) => {
    const id = args.item?.id ?? '';
    if (!id.endsWith('_excelexport') && !id.endsWith('_pdfexport')) return;
    const titles = new Map(data.jobTitles.map((j) => [j.id, j.name]));
    const byId = new Map(data.employees.map((e) => [e.id, e]));
    const dataSource = data.employees.map((e) => ({
      firstName: e.firstName, lastName: e.lastName, designation: titles.get(e.jobTitleId) ?? '', gender: e.gender, email: e.email,
      dobText: e.dateOfBirth, reportsTo: e.reportsToId && byId.get(e.reportsToId) ? fullName(byId.get(e.reportsToId)!) : '',
    }));
    if (id.endsWith('_excelexport')) grid.current?.excelExport({ fileName: 'sales-team.xlsx', columns: EXPORT_COLUMNS, dataSource });
    else grid.current?.pdfExport({ fileName: 'sales-team.pdf', pageOrientation: 'Landscape', columns: EXPORT_COLUMNS, dataSource });
  };

  return (
    <>
      <PageHeader title="Team" description={`${rows.length} people in the sales organisation. Add, edit or delete people, search, sort, or export the list.`} />
      <GridComponent key={phone ? 'phone' : 'wide'} id="team-grid" ref={grid} dataSource={rows} allowSorting allowPaging pageSettings={{ pageSize: 15 }}
        enableAdaptiveUI={phone} rowRenderingMode={phone ? 'Vertical' : 'Horizontal'}
        rowSelected={syncToolbar} rowDeselected={syncToolbar} dataBound={syncToolbar}
        allowExcelExport allowPdfExport toolbarClick={toolbarClick} actionBegin={actionBegin} actionComplete={actionComplete}
        editSettings={{ allowAdding: true, allowEditing: true, allowDeleting: true, mode: 'Dialog', showDeleteConfirmDialog: true }}
        toolbar={['Add', 'Edit', 'Delete', 'Search', 'ExcelExport', 'PdfExport']}
        sortSettings={{ columns: [{ field: 'lastName', direction: 'Ascending' }] }}>
        <ColumnsDirective>
          <ColumnDirective field="id" isPrimaryKey visible={false} />
          <ColumnDirective headerText="Photo" template={photoTemplate as never} width={72} allowSorting={false} allowEditing={false} />
          <ColumnDirective field="firstName" headerText="First name" width={110} validationRules={{ ...required, minLength: 2, maxLength: 100 }} />
          <ColumnDirective field="lastName" headerText="Last name" width={110} validationRules={{ ...required, minLength: 2, maxLength: 100 }} />
          <ColumnDirective field="jobTitleId" headerText="Designation" width={130} foreignKeyField="id" foreignKeyValue="name"
            dataSource={data.jobTitles as never} editType="dropdownedit" defaultValue={srTitleId as never} validationRules={required} />
          <ColumnDirective field="gender" headerText="Gender" width={90} editType="dropdownedit" validationRules={required}
            edit={{ params: { dataSource: GENDERS } }} />
          <ColumnDirective field="email" headerText="Email" width={240} clipMode="EllipsisWithTooltip" validationRules={{ ...required, email: true }} />
          <ColumnDirective field="dob" headerText="Date of birth" type="date" editType="datepickeredit" format={{ type: 'date', format: 'MMM d, yyyy' }} width={120} validationRules={required} />
          <ColumnDirective field="reportsToId" headerText="Reports to" width={140} foreignKeyField="id" foreignKeyValue="name"
            dataSource={managers as never} editType="dropdownedit" template={reportsToTemplate as never} />
        </ColumnsDirective>
        <Inject services={[Sort, Toolbar, Search, Page, Edit, ForeignKey, ExcelExport, PdfExport]} />
      </GridComponent>
      {host}
    </>
  );
}
