/**
 * Test environment setup. Preloaded by `bunfig.toml` before any test file runs.
 *
 * Registers happy-dom globals (window, document, navigator, etc.) so React
 * Testing Library works under `bun test`. The afterAll cleanup is critical —
 * without it, GlobalRegistrator keeps the event loop alive after tests finish,
 * causing `bun test` to hang indefinitely.
 *
 * Global mock.module() calls here run ONCE at process start before any test file
 * is evaluated. UI/third-party library mocks belong here. Hook mocks do NOT —
 * hook unit tests import the same module and would receive the stub instead of the
 * real implementation. Hook mocks belong in z_pages/ test files, which sort
 * alphabetically after hooks/ and therefore run after hook unit tests.
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { afterAll, mock } from 'bun:test'
import React from 'react'

if (!GlobalRegistrator.isRegistered) {
  GlobalRegistrator.register({ url: 'http://localhost/' })
}

afterAll(async () => {
  if (GlobalRegistrator.isRegistered) {
    await GlobalRegistrator.unregister()
  }
})

// ─── Global UI / Third-Party Library Mocks ────────────────────────────────
// Safe to mock globally: these are UI primitives with no hook tests of their own.

// lucide-react: stub all icons as simple spans (avoids SVG rendering issues in happy-dom).
// Uses a plain object (NOT a Proxy) so that both `import { X }` and
// `import * as _lucide; _lucide.X` work — Proxy dynamic-get is invisible to
// Bun's ESM namespace wrapper.
function _makeIcon(name: string) {
  // eslint-disable-next-line react/display-name
  return ({ size, className }: { size?: number; className?: string }) =>
    React.createElement('span', { 'data-testid': `icon-${name}`, className, 'data-size': size })
}
const _lucideMock = {
  Activity: _makeIcon('activity'),
  AlertTriangle: _makeIcon('alerttriangle'),
  ArrowRight: _makeIcon('arrowright'),
  Calendar: _makeIcon('calendar'),
  CalendarIcon: _makeIcon('calendaricon'),
  Camera: _makeIcon('camera'),
  Check: _makeIcon('check'),
  ChevronDownIcon: _makeIcon('chevrondownicon'),
  CheckCircle2: _makeIcon('checkcircle2'),
  CheckIcon: _makeIcon('checkicon'),
  ChevronDown: _makeIcon('chevrondown'),
  ChevronLeft: _makeIcon('chevronleft'),
  ChevronLeftIcon: _makeIcon('chevronlefticon'),
  ChevronRight: _makeIcon('chevronright'),
  ChevronRightIcon: _makeIcon('chevronrighticon'),
  ChevronUp: _makeIcon('chevronup'),
  ChevronsUpDown: _makeIcon('chevronsupsown'),
  Circle: _makeIcon('circle'),
  Clock: _makeIcon('clock'),
  CreditCard: _makeIcon('creditcard'),
  Download: _makeIcon('download'),
  FileSignature: _makeIcon('filesignature'),
  FileText: _makeIcon('filetext'),
  Image: _makeIcon('image'),
  List: _makeIcon('list'),
  Loader2: _makeIcon('loader2'),
  Lock: _makeIcon('lock'),
  LogOut: _makeIcon('logout'),
  Mail: _makeIcon('mail'),
  Maximize2: _makeIcon('maximize2'),
  Minimize2: _makeIcon('minimize2'),
  MoreHorizontal: _makeIcon('morehorizontal'),
  PanelLeft: _makeIcon('panelleft'),
  Paperclip: _makeIcon('paperclip'),
  Pencil: _makeIcon('pencil'),
  Phone: _makeIcon('phone'),
  Pill: _makeIcon('pill'),
  RefreshCw: _makeIcon('refreshcw'),
  Search: _makeIcon('search'),
  Shield: _makeIcon('shield'),
  Trash2: _makeIcon('trash2'),
  Upload: _makeIcon('upload'),
  Users: _makeIcon('users'),
  X: _makeIcon('x'),
}
mock.module('lucide-react', () => _lucideMock)

// @/components/badge — shadcn primitive
mock.module('@/components/badge', () => ({
  Badge: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    React.createElement('span', { 'data-testid': 'badge', className }, children),
}))

// @/components/dialog — Radix portal won't work in happy-dom
mock.module('@/components/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? React.createElement('div', { role: 'dialog' }, children) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  DialogTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
  DialogDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
  DialogFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}))

// @/components/sheet — Radix portal won't work in happy-dom
mock.module('@/components/sheet', () => ({
  Sheet: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open !== false ? React.createElement('div', { role: 'dialog', 'data-testid': 'sheet' }, children) : null,
  SheetContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SheetHeader: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SheetTitle: ({ children }: { children: React.ReactNode }) =>
    React.createElement('h2', null, children),
  SheetDescription: ({ children }: { children: React.ReactNode }) =>
    React.createElement('p', null, children),
  SheetTrigger: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SheetFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
}))

// @tanstack/react-router — Link renders as a plain anchor
mock.module('@tanstack/react-router', () => ({
  Link: ({ to, children, className, 'data-testid': testId }: {
    to: string; children: React.ReactNode; className?: string; 'data-testid'?: string
  }) =>
    React.createElement('a', { href: to, className, 'data-testid': testId }, children),
  useParams: () => ({}),
  useNavigate: () => () => {},
  useSearch: () => ({}),
  useRouter: () => ({ navigate: () => {} }),
  createFileRoute: () => () => ({}),
  Outlet: () => null,
}))

// ─── Swiper (timeline-carousel) ───────────────────────────────────────────
// Captures Swiper props so tests can inspect initialSlide, onSlideChange, etc.
// Access via: (globalThis as any).__swiperCaptures

;(globalThis as Record<string, unknown>).__swiperCaptures = {}

mock.module('swiper/react', () => ({
  Swiper: (props: Record<string, unknown>) => {
    const captures = (globalThis as Record<string, unknown>).__swiperCaptures as Record<string, unknown>
    captures.initialSlide = props.initialSlide
    captures.onSlideChange = props.onSlideChange
    const children = props.children as React.ReactNode
    return React.createElement('div', { 'data-testid': 'swiper' }, children)
  },
  SwiperSlide: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'swiper-slide' }, children),
}))

mock.module('swiper/modules', () => ({
  EffectCoverflow: {},
  Pagination: {},
  Keyboard: {},
  Navigation: {},
  Autoplay: {},
}))

mock.module('swiper/css', () => ({}))
mock.module('swiper/css/effect-coverflow', () => ({}))
mock.module('swiper/css/pagination', () => ({}))
mock.module('swiper/css/navigation', () => ({}))

// ─── Workspace components (timeline-carousel deps) ────────────────────────

mock.module('@/features/workspace/components/dental-chart', () => ({
  DentalChart: () => React.createElement('div', { 'data-testid': 'dental-chart-stub' }),
}))

mock.module('@/features/workspace/hooks/use-update-visit', () => ({
  useUpdateVisit: () => ({ mutate: () => {}, isPending: false, error: null }),
}))

// ─── Imaging workspace (comparison-view dep) ──────────────────────────────

mock.module('@/features/imaging/components/imaging-workspace', () => ({
  ImagingWorkspace: ({ imageUrl }: { imageUrl?: string }) =>
    React.createElement('div', { 'data-testid': 'imaging-workspace-stub', 'data-src': imageUrl }),
}))

// ─── @/components/select — Radix portal won't work in happy-dom ──────────

mock.module('@/components/select', () => ({
  Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (v: string) => void; children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'select', 'data-value': value, 'data-onvaluechange': onValueChange ? 'fn' : undefined }, children),
  SelectGroup: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', null, children),
  SelectValue: ({ placeholder, children }: { placeholder?: string; children?: React.ReactNode }) =>
    React.createElement('span', { 'data-testid': 'select-value' }, children ?? placeholder),
  SelectTrigger: ({ children, className, 'aria-label': ariaLabel }: { children?: React.ReactNode; className?: string; 'aria-label'?: string }) =>
    React.createElement('button', { type: 'button', 'aria-label': ariaLabel, className, 'data-testid': 'select-trigger' }, children),
  SelectContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'select-content' }, children),
  SelectItem: ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) =>
    React.createElement('div', { 'data-testid': `select-item-${value}`, 'data-value': value, role: 'option', className }, children),
  SelectSeparator: () => React.createElement('hr', null),
  SelectLabel: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', null, children),
  SelectScrollUpButton: () => null,
  SelectScrollDownButton: () => null,
}))

