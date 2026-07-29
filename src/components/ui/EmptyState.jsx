import { CircleUserRound } from "lucide-react";

export function EmptyState({
  icon: Icon = CircleUserRound,
  title,
  description,
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
