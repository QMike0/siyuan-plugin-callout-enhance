export type CalloutTypeItem = {
    type: string;
    label: string;
    icon: string;
};

export const CALLOUT_TYPES: CalloutTypeItem[] = [
    { type: "Info", label: "Info", icon: "ℹ️" },
    { type: "NOTE", label: "Note", icon: "🖊️" },
    { type: "IMPORTANT", label: "Important", icon: "✨" },
    { type: "Quote", label: "Quote", icon: "❞" },
    { type: "TIP", label: "Tip", icon: "💡" },
    { type: "WARNING", label: "Warning", icon: "⚠️" },
    { type: "CAUTION", label: "Caution", icon: "🚨" },
    { type: "Question", label: "Question", icon: "❓" },
];
