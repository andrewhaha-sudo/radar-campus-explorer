import { CampusExplorer } from "./components/map/CampusExplorer";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#campus-map">
        Skip to interactive map
      </a>
      <main>
        <CampusExplorer />
      </main>
    </>
  );
}
