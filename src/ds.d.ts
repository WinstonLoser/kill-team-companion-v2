/**
 * 设计系统（design-system/）的环境类型声明。
 *
 * design-system/ 是 Claude Design 项目 f378e79c 的逐字导入，位于 src/ 之外，
 * 因此不参与 tsc 的类型检查。组件为 .jsx，其 props 由同目录的 .d.ts 描述。
 * 这里把这些 props 重述为 `@ds/*` 模块的环境声明：
 *   - 类型：由本文件提供（tsc 不去解析真实文件）
 *   - 运行时：由 vite.config.ts 的 `@ds` 别名解析到 design-system/
 *
 * 注意：本文件必须保持「全局脚本」形态（不得出现顶层 import/export），
 * 否则 `declare module` 会被当成模块增强，而 `@ds/*` 并不存在于磁盘解析路径上，
 * 会报 TS2307。React 类型一律用 `import('react').X` 内联写法。
 *
 * 改动设计系统组件的 props 时，必须同步更新这里。
 * 应用代码只允许从 src/ui/ds 引入，不要直接 import '@ds/components/...'。
 */

declare module '@ds/components/core/Button.jsx' {
  export interface ButtonProps {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    disabled?: boolean
    icon?: import('react').ReactNode
    children: import('react').ReactNode
    onClick?: () => void
    style?: import('react').CSSProperties
  }
  export function Button(props: ButtonProps): import('react').ReactElement
}

declare module '@ds/components/core/IconButton.jsx' {
  export interface IconButtonProps {
    icon: import('react').ReactNode
    label: string
    active?: boolean
    onClick?: () => void
    size?: number
  }
  export function IconButton(props: IconButtonProps): import('react').ReactElement
}

declare module '@ds/components/core/Badge.jsx' {
  export interface BadgeProps {
    tone?: 'neutral' | 'accent' | 'danger' | 'success' | 'warning'
    children: import('react').ReactNode
  }
  export function Badge(props: BadgeProps): import('react').ReactElement
}

declare module '@ds/components/core/Tag.jsx' {
  export interface TagProps {
    children: import('react').ReactNode
    onRemove?: () => void
  }
  export function Tag(props: TagProps): import('react').ReactElement
}

declare module '@ds/components/forms/Input.jsx' {
  export interface InputProps {
    label?: string
    placeholder?: string
    value?: string
    onChange?: (value: string) => void
    type?: string
    error?: string
  }
  export function Input(props: InputProps): import('react').ReactElement
}

declare module '@ds/components/forms/Select.jsx' {
  export interface SelectOption {
    value: string
    label: string
  }
  export interface SelectProps {
    label?: string
    value?: string
    onChange?: (value: string) => void
    options: SelectOption[]
  }
  export function Select(props: SelectProps): import('react').ReactElement
}

declare module '@ds/components/forms/Checkbox.jsx' {
  export interface CheckboxProps {
    label: string
    checked?: boolean
    onChange?: (checked: boolean) => void
  }
  export function Checkbox(props: CheckboxProps): import('react').ReactElement
}

declare module '@ds/components/forms/Switch.jsx' {
  export interface SwitchProps {
    label: string
    checked?: boolean
    onChange?: (checked: boolean) => void
  }
  export function Switch(props: SwitchProps): import('react').ReactElement
}

declare module '@ds/components/forms/Stepper.jsx' {
  export interface StepperProps {
    label?: string
    value: number
    min?: number
    max?: number
    onChange?: (value: number) => void
  }
  export function Stepper(props: StepperProps): import('react').ReactElement
}

declare module '@ds/components/feedback/Card.jsx' {
  export interface CardProps {
    title?: string
    eyebrow?: string
    corner?: boolean
    dossier?: boolean
    children: import('react').ReactNode
    footer?: import('react').ReactNode
  }
  export function Card(props: CardProps): import('react').ReactElement
}

declare module '@ds/components/feedback/Modal.jsx' {
  export interface ModalProps {
    open: boolean
    title: string
    onClose?: () => void
    children: import('react').ReactNode
    footer?: import('react').ReactNode
  }
  export function Modal(props: ModalProps): import('react').ReactElement | null
}

declare module '@ds/components/feedback/ProgressBar.jsx' {
  export interface ProgressBarProps {
    value: number
    max?: number
    tone?: 'accent' | 'danger' | 'success'
    label?: string
  }
  export function ProgressBar(props: ProgressBarProps): import('react').ReactElement
}

declare module '@ds/components/navigation/TopBar.jsx' {
  export interface TopBarProps {
    title: string
    eyebrow?: string
    actions?: import('react').ReactNode
  }
  export function TopBar(props: TopBarProps): import('react').ReactElement
}

declare module '@ds/components/navigation/TabBar.jsx' {
  export interface TabBarTab {
    value: string
    label: string
  }
  export interface TabBarProps {
    tabs: TabBarTab[]
    active: string
    onChange?: (value: string) => void
  }
  export function TabBar(props: TabBarProps): import('react').ReactElement
}

declare module '@ds/styles.css'
