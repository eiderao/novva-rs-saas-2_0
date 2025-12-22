import { useParams } from 'react-router-dom';

export default function Evaluation() {
  const { applicationId } = useParams();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Avaliação do Candidato</h1>
      <p>Avaliando candidatura ID: {applicationId}</p>
    </div>
  );
}