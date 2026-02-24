function LoadingState({ label = 'Loading...' }) {
  return (
    <div className="loading-wrap">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}

export default LoadingState;
