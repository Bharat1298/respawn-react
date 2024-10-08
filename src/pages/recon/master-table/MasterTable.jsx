import React, { useState, useEffect, useRef } from "react";
import './master-table.css';

import db from '../../../firebase.config';
import reconfig from '../../../recon.config';
import FormInput from "../../../components/form-input/FormInput";
import { onSnapshot, doc, query, collection, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { useAuthState } from 'react-firebase-hooks/auth';
import { useNavigate } from 'react-router-dom';
import { SimpleLineChart, SimpleRadialChart } from "../../../lib/charts";
import { ResponsiveContainer } from "recharts";

function MasterTable() {
    const [data, setData] = useState({});
    const [averages, setAverages] = useState({});
    const [maximums, setMaximums] = useState({});
    const [sortField, setField] = useState('points-scored');
    const chartRefs = useRef([]);
    const [numericalFields, setNumericalFields] = useState([]);
    const auth = getAuth();
    const [user, loading] = useAuthState(auth);
    const navigate = useNavigate();
    const fetchTeamName = async () => {
        const q = query(collection(db, "teams"), where("users", "array-contains", user?.uid));
        const doc = await getDocs(q);
        return doc;
    }

    const getNumericalInputs = inputs => {
        return inputs
            .filter(f =>
                f.type === 'checkbox' ||
                f.type === 'number' ||
                f.type === 'select' ||
                f.type === 'togglebutton' ||
                f.type === '0' ||
                f.type === '1'
            )
            .map(f => {
                return f.name;
            });
    }

    const formatChartData = (data, type, team) => {
        switch (type) {
            case 'line':
                return data[team].map(entry => {
                    return {
                        'name': "Match " + entry['match'],
                        'Points': parseInt(entry[sortField])
                    }
                });
            case 'radial':
                return Object.keys(averages[team]).map(k => {
                    return {
                        label: k.replace(/(-|_)+/g, " ").toLowerCase().replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase()),
                        A: (parseFloat(averages[team][k]) * 100 / parseFloat(maximums[k])).toFixed(0),
                    }
                });
        }
    }

    useEffect(_ => {
        if (loading) return
        if (!user) return navigate('/signin')
        fetchTeamName().then(userData => {
            if (userData.docs[0].data().team === '') return navigate('/create-join-team')
            setNumericalFields(i => i.concat(getNumericalInputs(userData.docs[0].data().fields ?? [])));
            onSnapshot(doc(db, 'recon',
                `${userData.docs[0].data().teamName}-${userData.docs[0].data().regional}`), doc => setData(
                    Object.keys(doc.data())
                        .reduce((sortedData, team) => {
                            sortedData[team] = doc.data()[team]
                                .sort((a, b) => parseInt(a['match']) < parseInt(b['match']) ? -1 : 1);
                            return sortedData;
                        }, {})
                ));
        });
    }, [user, loading]);

    useEffect(_ => { setNumericalFields(getNumericalInputs(reconfig.data)) }, []);

    useEffect(_ => {
        const avg = Object.keys(data).reduce((averages, teamNum) => {
            if (!data[teamNum].length > 0) return averages;
            averages[teamNum] = numericalFields
                .filter(f =>
                    f !== 'team' &&
                    f !== 'match' &&
                    f !== 'alliance'
                )
                .reduce((result, field) => {
                    result[field] = (data[teamNum].reduce((sum, m) => sum +
                        (typeof m[field] === 'boolean' || typeof m[field] === 'number' ? m[field] : parseInt(m[field]))
                        , 0) / data[teamNum].length).toFixed(1);
                    return result;
                }, {});
            return averages;
        }, {});
        setAverages(avg);
    }, [data]);

    useEffect(_ => {
        let allEntries = [];
        Object.keys(data).forEach(team => data[team].forEach(e => allEntries.push(e)));
        const max = numericalFields
            .filter(f =>
                f !== 'team' &&
                f !== 'match' &&
                f !== 'alliance'
            )
            .reduce((maximums, field) => {
                maximums[field] = Math.max(...allEntries.map(e => e[field]));
                return maximums;
            }, {});
        setMaximums(max)
    }, [data, numericalFields])

    const displayAdditional = i => {
        chartRefs.current[i].hidden = !chartRefs.current[i].hidden;
        chartRefs.current[i].style.display = chartRefs.current[i].hidden ? 'flex' : 'none';
    }

    return <> {Object.keys(averages ?? {})[0] ?
        <div id='master-table'>
            <div className='master-table-row'>
                <div className='master-table-cell master-table-heading'>Team</div>
                {Object.keys(averages ?? {})[0] && Object.keys(averages[Object.keys(averages)[0]] ?? {}).map((field) => {
                    return <div className='master-table-cell master-table-heading' onClick={_ => setField(field)}>
                        Average {field.replace(/(-|_)+/g, " ").toLowerCase().replace(/(^|\s)[a-z]/g, (c) => c.toUpperCase())}
                    </div>;
                })}
                <div className='master-table-cell master-table-heading' onClick={_ => chartRefs.current.forEach((_, i) => displayAdditional(i))}>
                    Show All Charts
                </div>
            </div>
            {Object.keys(averages ?? {}).sort((a, b) => averages[b][sortField] - averages[a][sortField]).map((team, k) => {
                return <>
                    <div className='master-table-row'>
                        <td className='master-table-cell'><o>{team}</o></td>
                        {Object.keys(averages[team]).map(a => <td className='master-table-cell'>{averages[team][a]}</td>)}
                        <td className='master-table-cell' onClick={_ => displayAdditional(k)}>Show Charts</td>
                    </div>
                    <div className='column' id='master-charts-container' ref={e => chartRefs.current[k] = e}>
                        <div className='master-chart-container'>
                            <ResponsiveContainer width="100%" aspect={2} maxHeight={200} className='master-charts-box'>
                                <SimpleLineChart data={formatChartData(data, 'line', team)} />
                            </ResponsiveContainer>
                        </div>
                        <div className='master-chart-container'>
                            <ResponsiveContainer width="100%" aspect={2} maxHeight={200} className='master-charts-box'>
                                <SimpleRadialChart data={formatChartData(data, 'radial', team)} />
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            })}
        </div> : <p className='heading'>No Data Found</p>
    } </>;
}

export default MasterTable;