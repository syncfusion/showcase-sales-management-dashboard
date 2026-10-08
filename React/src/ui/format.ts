const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd0Fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('en-US');
const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
export const usd = (n: number) => usdFmt.format(n);
export const usd0 = (n: number) => usd0Fmt.format(n);
export const num = (n: number) => numFmt.format(n);
export const shortDate = (d: Date) => dateFmt.format(d);
export const dateTime = (d: Date) => dateTimeFmt.format(d);
/** Readable zone name ("India Standard Time"), falling back to the IANA id. */
export const timeZoneName = () =>
  new Intl.DateTimeFormat('en-US', { timeZoneName: 'long' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value
  ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
export function relativeDays(d: Date, now: Date): string {
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}
