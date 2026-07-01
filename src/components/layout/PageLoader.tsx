import Spinner from "./Spinner";

export default function PageLoader() {
  return (
    <div className="screen items-center justify-center">
      <Spinner size={36} />
    </div>
  );
}
