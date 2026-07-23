import BigNumber from 'bignumber.js';
import { createColors } from 'picocolors';

import { BundleDetails, BundleTrade } from './api';

export interface PricedAmount {
  raw: bigint;
  human: string;
  usd: string;
  symbol: string;
}

export function toHuman(rawAmount: bigint, decimals: number): string {
  return new BigNumber(rawAmount.toString()).shiftedBy(-decimals).toFixed();
}

const USD_DISPLAY_DP: number = 6;

export function toUsd(human: string, usdPrice: string): string {
  return new BigNumber(human)
    .times(usdPrice)
    .decimalPlaces(USD_DISPLAY_DP, BigNumber.ROUND_HALF_UP)
    .toFixed();
}

export function price(
  raw: bigint,
  decimals: number,
  usdPrice: string,
  symbol: string,
): PricedAmount {
  const human: string = toHuman(raw, decimals);
  return { raw, human, usd: toUsd(human, usdPrice), symbol };
}

export function deriveUnitUsdPrice(
  usdValue: number,
  human: string,
  fallback: string | undefined,
): string {
  const humanBn: BigNumber = new BigNumber(human);
  if (humanBn.isZero()) {
    return fallback ?? '1';
  }
  return new BigNumber(usdValue).dividedBy(humanBn).toFixed();
}

export interface Deviation {
  bps: number;
  absToken: string;
  absUsd: string;
}

export function deviation(expected: string, actual: string, usdPrice: string): Deviation {
  const expectedBn: BigNumber = new BigNumber(expected);
  const actualBn: BigNumber = new BigNumber(actual);
  const absTokenBn: BigNumber = actualBn.minus(expectedBn);

  const bps: number = expectedBn.isZero()
    ? 0
    : absTokenBn.dividedBy(expectedBn).times(10000).toNumber();

  return {
    bps,
    absToken: absTokenBn.toFixed(),
    absUsd: absTokenBn.times(usdPrice).toFixed(),
  };
}

export interface QuoteLine {
  label: string;
  priced: PricedAmount;
}

export interface BalanceRow {
  chain: string;
  symbol: string;
  before: string;
  expectedAfter: string;
  actualAfter?: string;
}

export interface ReconRow {
  field: string;
  quote: string;
  explorer: string;
  deviation: Deviation;
}

export interface TxRow {
  side: 'src' | 'dst';
  hash: string;
  url: string;
}

export interface Timeline {
  srcDebitedS?: number;
  dstCreditedS?: number;
  fulfilledS?: number;
  finalizedS?: number;
}

export interface QuoteSummary {
  pay: PricedAmount;
  fee: PricedAmount;
  receiveEstimate: PricedAmount;
  receiveGuaranteed: PricedAmount;
}

export interface MaxDetail {
  balance: string;
  opex: string;
  reserve: number;
  resultAmount: string;
}

export interface ReportHeader {
  kind?: 'Deposit' | 'Withdraw' | 'Trade';
  fromChain: string;
  fromToken: string;
  amount: string;
  toChain: string;
  toToken: string;
  bundleId?: string;
  bundleUrl?: string;
}

export interface LinkRow {
  label: string;
  url: string;
}

export interface FinalDeviation {
  label: string;
  deviation: Deviation;
}

export interface VerificationRow {
  field: string;
  expected: string;
  actual: string;
  ok: boolean;
  note?: string;
}

export interface ApprovalSummary {
  spender: string;
  token: string;
  required: string;
  current: string;
  sufficient: boolean;
}

export interface DepositReport {
  header: ReportHeader;
  quote: QuoteSummary;
  maxDetail?: MaxDetail;
  balances: BalanceRow[];
  reconciliation: ReconRow[];
  txs: TxRow[];
  links: LinkRow[];
  timeline: Timeline;
  finalDeviations: FinalDeviation[];
  summaryLine: string;
  dryRun?: boolean;
  approval?: ApprovalSummary;
  verifications?: VerificationRow[];
}

export type AttachmentType = 'json' | 'text';

export interface FlowReporter {
  step<T>(name: string, fn: () => Promise<T>): Promise<T>;
  stepStart(name: string): void;
  stepEnd(name: string, ok: boolean, ms: number): void;
  attach(name: string, body: string | object, type?: AttachmentType): void;
  param(name: string, value: string): void;
  event(name: string, data?: Record<string, unknown>): void;
  render(report: DepositReport): void;
}

export abstract class BaseReporter implements FlowReporter {
  async step<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.stepStart(name);
    const startedAt: number = Date.now();
    try {
      const result: T = await fn();
      this.stepEnd(name, true, Date.now() - startedAt);
      return result;
    } catch (error) {
      this.stepEnd(name, false, Date.now() - startedAt);
      throw error;
    }
  }

  abstract stepStart(name: string): void;
  abstract stepEnd(name: string, ok: boolean, ms: number): void;
  abstract attach(name: string, body: string | object, type?: AttachmentType): void;
  abstract param(name: string, value: string): void;
  abstract event(name: string, data?: Record<string, unknown>): void;
  abstract render(report: DepositReport): void;
}

type Colors = ReturnType<typeof createColors>;

export type Align = 'left' | 'right';

export type DeviationLevel = 'ok' | 'warn' | 'alert';

const ANSI_PATTERN: RegExp = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '');
}

export function visibleWidth(text: string): number {
  return stripAnsi(text).length;
}

function padVisible(text: string, width: number, align: Align): string {
  const padding: string = ' '.repeat(Math.max(0, width - visibleWidth(text)));
  return align === 'right' ? padding + text : text + padding;
}

export function padColumns(
  rows: readonly (readonly string[])[],
  aligns: readonly Align[] = [],
): string[] {
  const columnCount: number = rows.reduce(
    (max: number, row: readonly string[]) => Math.max(max, row.length),
    0,
  );

  const widths: number[] = [];
  for (let col = 0; col < columnCount; col++) {
    widths[col] = rows.reduce(
      (max: number, row: readonly string[]) => Math.max(max, visibleWidth(row[col] ?? '')),
      0,
    );
  }

  return rows.map((row: readonly string[]) =>
    row
      .map((cell: string, col: number) => padVisible(cell, widths[col], aligns[col] ?? 'left'))
      .join('  ')
      .replace(/ +$/, ''),
  );
}

export function box(title: string, lines: readonly string[]): string[] {
  const inner: number = lines.reduce(
    (max: number, line: string) => Math.max(max, visibleWidth(line)),
    title.length + 2,
  );
  const top: string = `┌─ ${title} ${'─'.repeat(Math.max(0, inner - title.length - 1))}┐`;
  const body: string[] = lines.map((line: string) => `│ ${padVisible(line, inner, 'left')} │`);
  const bottom: string = `└${'─'.repeat(inner + 2)}┘`;
  return [top, ...body, bottom];
}

export function pickDeviationLevel(bps: number, threshold: number): DeviationLevel {
  const magnitude: number = Math.abs(bps);
  if (magnitude <= threshold) return 'ok';
  if (magnitude <= threshold * 2) return 'warn';
  return 'alert';
}

export function colorForLevel(text: string, level: DeviationLevel, colors: Colors): string {
  switch (level) {
    case 'ok':
      return colors.green(text);
    case 'warn':
      return colors.yellow(text);
    case 'alert':
      return colors.red(text);
  }
}

function formatDeviation(dev: Deviation, threshold: number, colors: Colors): string {
  const level: DeviationLevel = pickDeviationLevel(dev.bps, threshold);
  const sign: string = dev.bps > 0 ? '+' : '';
  const text: string = `${sign}${dev.bps.toFixed(2)} bps  (${dev.absToken} / $${dev.absUsd})`;
  return colorForLevel(text, level, colors);
}

function formatPriced(amount: PricedAmount): string {
  return `${amount.human} ${amount.symbol}  ($${amount.usd})`;
}

export interface ConsoleReporterOptions {
  alertBps: number;
  noColor?: boolean;
  out?: (line: string) => void;
}

export class ConsoleReporter extends BaseReporter {
  private readonly colors: Colors;
  private readonly alertBps: number;
  private readonly out: (line: string) => void;
  private readonly stepStartedAt: Map<string, number> = new Map();

  constructor(options: ConsoleReporterOptions) {
    super();
    const noColor: boolean =
      options.noColor ?? (!process.stdout.isTTY || Boolean(process.env.NO_COLOR));
    this.colors = createColors(!noColor);
    this.alertBps = options.alertBps;
    this.out = options.out ?? ((line: string) => process.stdout.write(`${line}\n`));
  }

  stepStart(name: string): void {
    this.stepStartedAt.set(name, Date.now());
    this.out(`${this.colors.cyan('⏳')} ${name}`);
  }

  stepEnd(name: string, ok: boolean, ms: number): void {
    const seconds: string = (ms / 1000).toFixed(1);
    if (ok) {
      this.out(`${this.colors.green('✓')} ${name} ${this.colors.dim(`(${seconds}s)`)}`);
    } else {
      this.out(`${this.colors.red('✗')} ${name} ${this.colors.dim(`(${seconds}s)`)}`);
    }
  }

  attach(name: string, _body: string | object, _type?: AttachmentType): void {
    this.out(this.colors.dim(`  ↳ attached ${name}`));
  }

  param(name: string, value: string): void {
    this.out(this.colors.dim(`  · ${name} = ${value}`));
  }

  event(name: string, data?: Record<string, unknown>): void {
    const suffix: string = data ? ` ${JSON.stringify(data)}` : '';
    this.out(this.colors.dim(`  • ${name}${suffix}`));
  }

  render(report: DepositReport): void {
    this.out('');
    if (report.dryRun) {
      this.out(this.colors.yellow('DRY RUN — bundle built & priced, not signed or submitted'));
      this.out('');
    }
    for (const line of this.buildHeader(report)) this.out(line);
    this.out('');
    for (const line of this.buildQuote(report)) this.out(line);
    if (report.approval) {
      this.out('');
      for (const line of this.buildApproval(report.approval)) this.out(line);
    }
    if (report.verifications !== undefined && report.verifications.length > 0) {
      this.out('');
      for (const line of this.buildVerifications(report.verifications)) this.out(line);
    }
    if (report.maxDetail) {
      this.out('');
      for (const line of this.buildMaxDetail(report)) this.out(line);
    }
    this.out('');
    for (const line of this.buildBalances(report.balances)) this.out(line);
    if (report.reconciliation.length > 0) {
      this.out('');
      for (const line of this.buildReconciliation(report.reconciliation)) this.out(line);
    }
    if (report.txs.length > 0) {
      this.out('');
      for (const line of this.buildTxs(report.txs)) this.out(line);
    }
    if (report.links.length > 0) {
      this.out('');
      for (const line of this.buildLinks(report.links)) this.out(line);
    }
    this.out('');
    for (const line of this.buildTimeline(report)) this.out(line);
    if (report.finalDeviations.length > 0) {
      this.out('');
      for (const line of this.buildFinalDeviations(report.finalDeviations)) this.out(line);
    }
    this.out('');
    this.out(this.summaryColor(report));
  }

  private buildHeader(report: DepositReport): string[] {
    const h: ReportHeader = report.header;
    const lines: string[] = padColumns([
      ['From', `${h.amount} ${h.fromToken}`, `on ${h.fromChain}`],
      ['To', h.toToken, `on ${h.toChain}`],
      ['Bundle', h.bundleId ?? this.colors.dim('(pending)')],
    ]);
    return box(h.kind ?? 'Deposit', lines);
  }

  private buildVerifications(rows: readonly VerificationRow[]): string[] {
    const lines: string[] = padColumns([
      ['', 'Field', 'Expected', 'Actual', ''],
      ...rows.map((row: VerificationRow): string[] => [
        row.ok ? this.colors.green('✓') : this.colors.red('✗'),
        row.field,
        row.expected,
        row.actual,
        row.note !== undefined ? this.colors.dim(`(${row.note})`) : '',
      ]),
    ]);
    return box('Verified before signing', lines);
  }

  private buildQuote(report: DepositReport): string[] {
    const q: QuoteSummary = report.quote;
    const lines: string[] = padColumns(
      [
        ['Pay', formatPriced(q.pay)],
        ['Fee', formatPriced(q.fee)],
        ['Receive (est)', formatPriced(q.receiveEstimate)],
        ['Receive (min)', formatPriced(q.receiveGuaranteed)],
      ],
      ['left', 'right'],
    );
    return box('Quote', lines);
  }

  private buildApproval(approval: ApprovalSummary): string[] {
    const status: string = approval.sufficient
      ? this.colors.green('✓ sufficient')
      : this.colors.red('✗ insufficient');
    const lines: string[] = padColumns(
      [
        ['Spender', approval.spender],
        ['Token', approval.token],
        ['Required', approval.required],
        ['Current', approval.current],
        ['Status', status],
      ],
      ['left', 'left'],
    );
    return box('Approval', lines);
  }

  private buildMaxDetail(report: DepositReport): string[] {
    const m: MaxDetail | undefined = report.maxDetail;
    if (!m) return [];
    const lines: string[] = padColumns(
      [
        ['Balance', m.balance],
        ['Operating expenses', m.opex],
        ['Reserve factor', `x${m.reserve}`],
        ['Resulting amount', m.resultAmount],
      ],
      ['left', 'right'],
    );
    return box('Max computation', lines);
  }

  private buildBalances(balances: readonly BalanceRow[]): string[] {
    const header: string[] = ['Chain', 'Token', 'Before', 'Expected', 'Actual'];
    const rows: string[][] = balances.map((b: BalanceRow) => [
      b.chain,
      b.symbol,
      b.before,
      b.expectedAfter,
      b.actualAfter ?? this.colors.dim('—'),
    ]);
    const lines: string[] = padColumns(
      [header, ...rows],
      ['left', 'left', 'right', 'right', 'right'],
    );
    return box('Balances', lines);
  }

  private buildReconciliation(recon: readonly ReconRow[]): string[] {
    const header: string[] = ['Field', 'Quote', 'Explorer', 'Deviation'];
    const rows: string[][] = recon.map((r: ReconRow) => [
      r.field,
      r.quote,
      r.explorer,
      formatDeviation(r.deviation, this.alertBps, this.colors),
    ]);
    const lines: string[] = padColumns([header, ...rows], ['left', 'right', 'right', 'left']);
    return box('Explorer reconciliation', lines);
  }

  private buildTxs(txs: readonly TxRow[]): string[] {
    const lines: string[] = padColumns(
      txs.map((t: TxRow) => [t.side, this.colors.cyan(t.url)]),
      ['left', 'left'],
    );
    return box('Transactions', lines);
  }

  private buildLinks(links: readonly LinkRow[]): string[] {
    const lines: string[] = padColumns(
      links.map((l: LinkRow) => [l.label, this.colors.cyan(l.url)]),
      ['left', 'left'],
    );
    return box('Links', lines);
  }

  private buildTimeline(report: DepositReport): string[] {
    const t: Timeline = report.timeline;
    const fmt: (value: number | undefined) => string = (value: number | undefined): string =>
      value === undefined ? this.colors.dim('—') : `${value.toFixed(1)}s`;
    const lines: string[] = padColumns(
      [
        ['Source debited', fmt(t.srcDebitedS)],
        ['Destination credited', fmt(t.dstCreditedS)],
        ['Fulfilled', fmt(t.fulfilledS)],
        ['Finalized', fmt(t.finalizedS)],
      ],
      ['left', 'right'],
    );
    return box('Timeline (from submit)', lines);
  }

  private buildFinalDeviations(deviations: readonly FinalDeviation[]): string[] {
    const lines: string[] = padColumns(
      deviations.map((d: FinalDeviation) => [
        d.label,
        formatDeviation(d.deviation, this.alertBps, this.colors),
      ]),
      ['left', 'left'],
    );
    return box('Deviations', lines);
  }

  private summaryColor(report: DepositReport): string {
    const worst: DeviationLevel = report.finalDeviations.reduce<DeviationLevel>(
      (level: DeviationLevel, d: FinalDeviation) => {
        const next: DeviationLevel = pickDeviationLevel(d.deviation.bps, this.alertBps);
        if (level === 'alert' || next === 'alert') return 'alert';
        if (level === 'warn' || next === 'warn') return 'warn';
        return 'ok';
      },
      'ok',
    );
    return colorForLevel(report.summaryLine, worst, this.colors);
  }
}

export interface PriceQuoteInput {
  payRaw: bigint;
  opexRaw: bigint;
  srcDecimals: number;
  srcUsdPrice: string;
  srcSymbol: string;
  recommendedRaw: bigint;
  guaranteedRaw: bigint;
  dstDecimals: number;
  dstUsdPrice: string;
  dstSymbol: string;
}

export function priceQuote(input: PriceQuoteInput): QuoteSummary {
  const pay: PricedAmount = price(
    input.payRaw,
    input.srcDecimals,
    input.srcUsdPrice,
    input.srcSymbol,
  );
  const fee: PricedAmount = price(
    input.opexRaw,
    input.srcDecimals,
    input.srcUsdPrice,
    input.srcSymbol,
  );
  const receiveEstimate: PricedAmount = price(
    input.recommendedRaw,
    input.dstDecimals,
    input.dstUsdPrice,
    input.dstSymbol,
  );
  const receiveGuaranteed: PricedAmount = price(
    input.guaranteedRaw,
    input.dstDecimals,
    input.dstUsdPrice,
    input.dstSymbol,
  );
  return { pay, fee, receiveEstimate, receiveGuaranteed };
}

export interface TxUrlBuilders {
  srcTxUrl: (hash: string) => string;
  dstTxUrl: (hash: string) => string;
}

export function collectTxs(details: BundleDetails, urls: TxUrlBuilders): TxRow[] {
  const txs: TxRow[] = [];
  for (const group of details.tradeGroups) {
    for (const trade of group.trades) {
      const bundleTrade: BundleTrade = trade;
      if (bundleTrade.srcTx?.transactionHash) {
        txs.push({
          side: 'src',
          hash: bundleTrade.srcTx.transactionHash,
          url: urls.srcTxUrl(bundleTrade.srcTx.transactionHash),
        });
      }
      if (bundleTrade.dstTx?.transactionHash) {
        txs.push({
          side: 'dst',
          hash: bundleTrade.dstTx.transactionHash,
          url: urls.dstTxUrl(bundleTrade.dstTx.transactionHash),
        });
      }
    }
  }
  return txs;
}
