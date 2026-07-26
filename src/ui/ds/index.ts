/**
 * 设计系统组件的唯一入口。
 *
 * 应用代码一律从这里引入（`import { Button } from '../ds'`），
 * 不要直接引用 design-system/ 内部路径 —— 这正是设计系统自带的
 * _adherence.oxlintrc.json 中 no-restricted-imports 规则所要求的。
 *
 * 类型来自 src/ds.d.ts，运行时由 vite.config.ts 的 `@ds` 别名解析。
 */
export { Button, type ButtonProps } from '@ds/components/core/Button.jsx'
export { IconButton, type IconButtonProps } from '@ds/components/core/IconButton.jsx'
export { Badge, type BadgeProps } from '@ds/components/core/Badge.jsx'
export { Tag, type TagProps } from '@ds/components/core/Tag.jsx'

export { Input, type InputProps } from '@ds/components/forms/Input.jsx'
export { Select, type SelectOption, type SelectProps } from '@ds/components/forms/Select.jsx'
export { Checkbox, type CheckboxProps } from '@ds/components/forms/Checkbox.jsx'
export { Switch, type SwitchProps } from '@ds/components/forms/Switch.jsx'
export { Stepper, type StepperProps } from '@ds/components/forms/Stepper.jsx'

export { Card, type CardProps } from '@ds/components/feedback/Card.jsx'
export { Modal, type ModalProps } from '@ds/components/feedback/Modal.jsx'
export { ProgressBar, type ProgressBarProps } from '@ds/components/feedback/ProgressBar.jsx'

export { TopBar, type TopBarProps } from '@ds/components/navigation/TopBar.jsx'
export { TabBar, type TabBarTab, type TabBarProps } from '@ds/components/navigation/TabBar.jsx'
