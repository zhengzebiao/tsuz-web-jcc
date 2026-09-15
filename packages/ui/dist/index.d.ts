import type { ReactNode } from "react";
export interface LogoProps {
    label?: string;
    subtitle?: string;
    className?: string;
}
export declare function Logo({ label, subtitle, className }: LogoProps): import("react").JSX.Element;
export interface PageContainerProps {
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
}
export declare function PageContainer({ title, description, actions, children, className }: PageContainerProps): import("react").JSX.Element;
export interface EmptyStateProps {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}
export declare function EmptyState({ title, description, action, className }: EmptyStateProps): import("react").JSX.Element;
export interface ErrorStateProps {
    title?: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}
export declare function ErrorState({ title, description, action, className }: ErrorStateProps): import("react").JSX.Element;
//# sourceMappingURL=index.d.ts.map