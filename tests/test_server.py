"""No network calls during tests. External provider responses are mocked."""
import json
import sys
from io import BytesIO
from pathlib import Path
from unittest import TestCase, mock
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server

VALID = {'origin_lat':['28.6315'],'origin_lon':['77.2167'],'dest_lat':['28.6129'],'dest_lon':['77.2295'],'mode':['walk']}

class APIValidationTests(TestCase):
    def setUp(self):
        server.CACHE.clear()
        for k in server.LAST: server.LAST[k] = None

    def test_first_request_allowed_at_zero_monotonic_time(self):
        with mock.patch.object(server.time, 'monotonic', return_value=0.0):
            server.rate_limit('geocode', 1.2)
            with self.assertRaises(RuntimeError):
                server.rate_limit('geocode', 1.2)

    def test_rejects_nan_inf_and_missing_coords(self):
        for bad in ('NaN','Infinity','-Infinity','',None):
            with self.assertRaises(ValueError):server.parse_number(bad,-90,90,'latitude')
    def test_rejects_bad_coords(self):
        with self.assertRaises(ValueError):server.coordinates({'origin_lat':['91'],'origin_lon':['40']},'origin')
        with self.assertRaises(ValueError):server.coordinates({'origin_lat':['28.6']},'origin')
    def test_invalid_profile_cannot_be_injected(self):
        params={**VALID,'mode':['helicopter']}
        with self.assertRaises(ValueError):server.get_routes(params)
    def test_same_destination_rejected(self):
        params={**VALID,'dest_lat':VALID['origin_lat'],'dest_lon':VALID['origin_lon']}
        with self.assertRaises(ValueError):server.get_routes(params)
    def test_invalid_geocode_inputs(self):
        with self.assertRaises(ValueError):server.get_geocode({'q':['a']})
        with self.assertRaises(ValueError):server.get_geocode({'q':['a'*150]})
    def test_geocode_uses_explicit_request_and_limits(self):
        with mock.patch.object(server,'safe_json_request',return_value=[{'display_name':'India Gate, New Delhi','lat':'28.6129','lon':'77.2295'}]) as remote:
            data=server.get_geocode({'q':['India Gate Delhi']})
            self.assertEqual(data['results'][0]['lat'],28.6129)
            self.assertIn('nominatim.openstreetmap.org',remote.call_args.args[0])
            self.assertIn('format=jsonv2',remote.call_args.args[0])
            server.get_geocode({'q':['India Gate Delhi']})
            self.assertEqual(remote.call_count,1)
    def test_geocode_cooldown(self):
        with mock.patch.object(server,'safe_json_request',return_value=[]):
            server.get_geocode({'q':['India Gate Delhi']})
            with self.assertRaises(RuntimeError):server.get_geocode({'q':['Delhi Gate Delhi']})
    def test_decodes_polyline_six(self):
        self.assertEqual(server.decode_polyline6('e~epoA|jfpOiDaK'),[[42.225139,-8.670911],[42.225224,-8.670718]])
    def test_rejects_truncated_polyline(self):
        with self.assertRaises(ValueError):server.decode_polyline6('~')
    def test_valhalla_keyless_route_real_geometry(self):
        fake={'trip':{'summary':{'time':600,'length':2.2},'legs':[{'shape':'e~epoA|jfpOiDaK'}]}}
        with mock.patch.object(server,'ORS_KEY',''):
            with mock.patch.object(server,'safe_json_request',return_value=fake) as remote:
                result=server.get_routes(VALID)
        self.assertEqual(result['dataMode'],'live')
        self.assertEqual(len(result['routes']),1)
        self.assertEqual(result['routes'][0]['durationMin'],10)
        self.assertTrue(result['routes'][0]['publicDemoServer'])
        self.assertEqual(result['routes'][0]['points'][0],[42.225139,-8.670911])
        self.assertIn('valhalla1',remote.call_args.args[0])
        self.assertEqual(remote.call_args.args[1]['costing'],'pedestrian')
    def test_ors_routes_return_alternatives(self):
        fake={'features':[{'geometry':{'coordinates':[[77.2,28.6],[77.21,28.61]]},'properties':{'summary':{'distance':1200,'duration':900}}}]}
        with mock.patch.object(server,'ORS_KEY','test-key'):
            with mock.patch.object(server,'safe_json_request',return_value=fake) as remote:
                result=server.get_routes(VALID)
        self.assertEqual(result['routes'][0]['durationMin'],15)
        self.assertEqual(result['routes'][0]['points'][0],[28.6,77.2])
        self.assertFalse(result['routes'][0]['publicDemoServer'])
        self.assertEqual(remote.call_args.args[1]['coordinates'][0],[77.2167,28.6315])
        self.assertIn('unknown',result['routes'][0]['warnings'][0].lower())
    def test_route_cache_avoids_extra_calls(self):
        fake={'trip':{'summary':{'time':600,'length':2.2},'legs':[{'shape':'e~epoA|jfpOiDaK'}]}}
        with mock.patch.object(server,'ORS_KEY',''):
            with mock.patch.object(server,'safe_json_request',return_value=fake) as remote:
                server.get_routes(VALID)
                result=server.get_routes(VALID)
        self.assertTrue(result['cached'])
        remote.assert_called_once()
    def test_no_invented_route_on_external_failure(self):
        with mock.patch.object(server,'ORS_KEY',''):
            with mock.patch.object(server,'safe_json_request',side_effect=RuntimeError('provider unavailable')):
                with self.assertRaises(RuntimeError):server.get_routes(VALID)
    def test_overpass_radius_limited(self):
        q=server.build_overpass_query([(28.6,77.2)])
        self.assertIn('around:700',q)
        self.assertNotIn('phone',q)
        self.assertIn('car_repair',q)
    def test_overpass_rejects_too_many_samples(self):
        with self.assertRaises(ValueError):server.build_overpass_query([(28.6,77.2)]*10)
    def test_extracts_pois_deduplicates_and_no_fake_open_now(self):
        example={'elements':[{'type':'node','id':1,'lat':28.6,'lon':77.2,'tags':{'name':'Hospital X','amenity':'hospital','opening_hours':'24/7'}},{'type':'node','id':1,'lat':28.6,'lon':77.2,'tags':{'name':'Hospital X','amenity':'hospital'}}]}
        places=server.places_from_overpass(example)
        self.assertEqual(len(places),1)
        self.assertIn('not verified',places[0]['source'])
    def test_lighting_is_never_treated_as_current_inspection(self):
        output={'elements':[{'type':'way','id':1,'tags':{'lit':'yes'}},{'type':'way','id':2,'tags':{'lit':'no'}},{'type':'way','id':3,'tags':{'lit':'no'}}]}
        body=BytesIO(json.dumps(output).encode())
        with mock.patch.object(server.urllib.request,'urlopen',return_value=body):
            result=server.get_lighting([(28.6,77.2)])
        self.assertEqual(result['tagCounts']['no'],2)
        self.assertEqual(result['taggedWayCount'],3)
        self.assertIn('NOT a current streetlight',result['warning'])
    def test_invalid_lighting_samples(self):
        with self.assertRaises(ValueError):server.build_overpass_query([(91,77.2)])


class MapConfigurationTests(TestCase):
    def test_only_browser_map_key_exposed(self):
        with mock.patch.dict(server.os.environ, {'MAPTILER_API_KEY':'browser-key','ORS_API_KEY':'private-routing-key'}):
            self.assertEqual(server.map_config(), {'maptilerKey':'browser-key'})
    def test_no_map_key_required(self):
        with mock.patch.dict(server.os.environ, {}, clear=True):
            self.assertEqual(server.map_config(), {'maptilerKey':''})
