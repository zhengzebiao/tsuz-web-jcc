import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Logo({ label = "Tsu MFE", subtitle = "Micro frontend workspace", className }) {
    return (_jsxs("div", { className: joinClassNames("tsu-logo", className), style: logoStyle, children: [_jsx("span", { "aria-hidden": "true", style: logoMarkStyle, children: "T" }), _jsxs("span", { children: [_jsx("strong", { style: logoLabelStyle, children: label }), _jsx("small", { style: logoSubtitleStyle, children: subtitle })] })] }));
}
export function PageContainer({ title, description, actions, children, className }) {
    return (_jsxs("section", { className: joinClassNames("tsu-page-container", className), style: pageContainerStyle, children: [title || description || actions ? (_jsxs("header", { style: pageHeaderStyle, children: [_jsxs("div", { children: [title ? _jsx("h1", { style: pageTitleStyle, children: title }) : null, description ? _jsx("p", { style: pageDescriptionStyle, children: description }) : null] }), actions ? _jsx("div", { children: actions }) : null] })) : null, children] }));
}
export function EmptyState({ title = "Nothing here yet", description, action, className }) {
    return (_jsxs("div", { className: joinClassNames("tsu-empty-state", className), style: stateStyle, children: [_jsx("strong", { children: title }), description ? _jsx("p", { style: stateDescriptionStyle, children: description }) : null, action ? _jsx("div", { children: action }) : null] }));
}
export function ErrorState({ title = "Something went wrong", description, action, className }) {
    return (_jsxs("div", { className: joinClassNames("tsu-error-state", className), style: { ...stateStyle, borderColor: "#fecaca", background: "#fff7f7" }, children: [_jsx("strong", { children: title }), description ? _jsx("p", { style: stateDescriptionStyle, children: description }) : null, action ? _jsx("div", { children: action }) : null] }));
}
function joinClassNames(...values) {
    return values.filter(Boolean).join(" ");
}
const logoStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    lineHeight: 1.1
};
const logoMarkStyle = {
    display: "inline-grid",
    placeItems: "center",
    width: 32,
    height: 32,
    borderRadius: 10,
    background: "linear-gradient(135deg, #1677ff, #7c3aed)",
    color: "#fff",
    fontWeight: 800
};
const logoLabelStyle = {
    display: "block",
    color: "inherit"
};
const logoSubtitleStyle = {
    display: "block",
    color: "#94a3b8",
    fontSize: 12
};
const pageContainerStyle = {
    display: "grid",
    gap: 24
};
const pageHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 24,
    alignItems: "flex-start"
};
const pageTitleStyle = {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.2,
    padding: '16px 0 0 16px'
};
const pageDescriptionStyle = {
    margin: "8px 0 0",
    color: "#64748b"
};
const stateStyle = {
    display: "grid",
    placeItems: "center",
    gap: 8,
    minHeight: 180,
    padding: 24,
    border: "1px dashed #bfdbfe",
    borderRadius: 16,
    background: "#f8fbff",
    color: "#31506f",
    textAlign: "center"
};
const stateDescriptionStyle = {
    margin: 0,
    color: "#64748b"
};
