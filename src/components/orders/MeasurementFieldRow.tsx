"use client";

// One measurement entry: the label with the value input right beside it, and
// an optional free-text remark filling the rest of the row — shared by the
// blouse and salwar forms so both keep the same layout. Replaces the old
// layout where the label sat far left and the input far right.
interface Props {
  label: string;
  value: string;
  note: string;
  striped: boolean;  // zebra background
  bordered: boolean; // top border (every row after the first)
  onValueChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}

export default function MeasurementFieldRow({
  label,
  value,
  note,
  striped,
  bordered,
  onValueChange,
  onNoteChange,
}: Props) {
  return (
    <div
      className={`flex items-center px-3 py-2.5 gap-2 ${striped ? "bg-[#FDFCFA]" : "bg-white"} ${bordered ? "border-t border-[#F0EDE6]" : ""}`}
    >
      <span className="w-[88px] shrink-0 text-sm font-semibold text-[#0F0F0F] leading-tight">
        {label}
      </span>
      <input
        className="w-16 shrink-0 text-center text-[15px] border border-[#E5E0D5] rounded-xl py-1.5 focus:outline-none focus:border-[#C9A84C]"
        placeholder="in"
        type="number"
        aria-label={label}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      />
      <input
        className="w-28 shrink-0 text-[13px] border border-[#E5E0D5] rounded-xl py-1.5 px-2 focus:outline-none focus:border-[#C9A84C] placeholder:text-[#C4C0B6]"
        placeholder="(note)"
        aria-label={`${label} note`}
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
      />
    </div>
  );
}
