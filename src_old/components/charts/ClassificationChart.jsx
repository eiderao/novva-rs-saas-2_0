import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';

const ClassificationChart = ({ data }) => {
  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="candidateName" type="category" width={150} />
          <Tooltip />
          <Legend />
          <Bar dataKey="notaTriagem" stackId="a" fill="#3f51b5" name="Nota Triagem">
            <LabelList dataKey="notaTriagem" position="center" fill="#fff" formatter={(value) => value.toFixed(1)} />
          </Bar>
          <Bar dataKey="notaCultura" stackId="a" fill="#8884d8" name="Nota Cultura">
             <LabelList dataKey="notaCultura" position="center" fill="#fff" formatter={(value) => value.toFixed(1)} />
          </Bar>
          <Bar dataKey="notaTecnico" stackId="a" fill="#82ca9d" name="Nota Técnico">
             <LabelList dataKey="notaTecnico" position="center" fill="#fff" formatter={(value) => value.toFixed(1)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClassificationChart;