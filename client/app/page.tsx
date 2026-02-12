import Filecomponent from "./componentes/file-upload";
export default function Home() {
  return (
    <div>
      <div className="min-h-screen w-screen flex">
        <div className="w-[30vw] min-h-screen">
<Filecomponent />
        </div>
        <div className="w-[70vw] min-h-screen border-1-2">2</div>
      </div>
    </div>
  );
}
