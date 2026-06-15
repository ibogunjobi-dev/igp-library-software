// Loading indicator.
export default function Spinner({ center }) {
  if (center) {
    return (
      <div className="spinner-center">
        <span className="spinner" aria-label="Loading" role="status" />
      </div>
    );
  }
  return <span className="spinner" aria-label="Loading" role="status" />;
}
