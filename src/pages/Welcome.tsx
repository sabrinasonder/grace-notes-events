import { Navigate } from "react-router-dom";

// /welcome is retired — /join is the single public landing page
const Welcome = () => <Navigate to="/join" replace />;
export default Welcome;
