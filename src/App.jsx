import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useRef, useMemo, useEffect, useState } from "react";
import { OrbitControls, Backdrop } from "@react-three/drei";
import {
	NoBlending,
	Color,
	MathUtils,
	Vector3,
	ShaderChunk,
	UniformsLib,
	UniformsUtils,
	ShaderMaterial,
	BackSide,
	DoubleSide,
} from "three";
import palettes from 'nice-color-palettes';
import { useControls, button, folder } from 'leva'
import { curlNoise } from "./shaders/curlNoise";
const getRandomPalette = () => {
	return palettes[Math.floor(Math.random() * palettes.length)];
}
const getRandomColors = () => {
	const palette = [...getRandomPalette()];
	const color1Index = Math.floor(Math.random() * palette.length)
	const color1 = palette[color1Index];
	// avoid getting the same color twice by removing it from the array
	palette.splice(color1Index, 1);
	const color2 = palette[Math.floor(Math.random() * palette.length)];
	return [color1, color2]
}

const fragmentShader = `

	uniform vec3 uLightPosition;
	varying vec3 vColor;
	varying vec4 vWorldPosition;

	#include <common>
	#include <packing>
	#include <fog_pars_fragment>
	#include <bsdfs>
	#include <lights_pars_begin>
	#include <shadowmap_pars_fragment>
	#include <shadowmask_pars_fragment>

	void main() {
		#include <logdepthbuf_fragment>

		vec3 color = vColor;

		// Light point
		// float strength = distance(gl_PointCoord, vec2(0.5));
		// strength = 1.0 - strength;
		// strength = pow(strength, 5.0);

		// Disc
		float strength = distance(gl_PointCoord, vec2(0.5));
		strength = step(0.5, strength);
		strength = 1.0 - strength;
		color =  mix(vec3(0.0), color, strength);
		
		if(color == vec3(0.)) discard;
		color *= (getShadowMask() * 2.);
	
		gl_FragColor = vec4(color, 1.);

	}
`;
const vertexShader = `
	uniform sampler2D uPositions;
	uniform vec3 uInnerColor;
	uniform vec3 uOuterColor;
	uniform float uCurlIntensity;
	uniform float uCurlAmplitude;
	uniform float uSelectedShape;
	uniform float uParticleSize;
	uniform float uSizeAttenuationMultiplier;
	uniform float uTime;
	uniform vec3 uLightPosition;
	varying float vOpacity;
	varying vec4 vWorldPosition;
	varying vec3 vParticleNormal;
	varying float vSomething;
	varying vec2 vHighPrecisionZW;
	const float PI = 3.1415926535897932384626433832795;
	${curlNoise}
	varying vec3 vColor;

	#include <common>
	#include <shadowmap_pars_vertex>
  
	void main() {
		float u = position.x;
		float v = position.y;
		vec3 pos = position;

		float distanceColorMultiplier;

		if(uSelectedShape == 1.0) {
			distanceColorMultiplier = 0.2;
			pos.x=((1. + (sin(PI * u)*sin(PI * v)))*sin((4. * PI) * v));
			pos.y=((1. + (sin(PI * u)*sin(PI * v)))*cos((4. * PI) * v));
			pos.z=((cos(PI * u)*sin(PI * v)+(4.*v)-2.));
		}

		if (uSelectedShape == 2.0) {
			distanceColorMultiplier = 0.9;
		}

		if (uSelectedShape == 3.0) {
			pos.x=(3.+ sin(2.*PI*u)*sin(2.*PI*v))*sin(2.*PI*v);
			pos.y=(3.+ sin(2.*PI*u)*sin(2.*PI*v))*cos(2.*PI*v);
			pos.z=cos(2.*PI*u)*sin(2.*PI*v)+4.*v-2.;
		}

		if (uSelectedShape == 4.0) {

			pos.x=u*cos(v);
			pos.y=u*sin(v);
			pos.z=v;

		}

		if (uSelectedShape == 6.0) {
			pos.x=u-((pow(u, 3.)/3.)+(pow(v,2.)*u));
			pos.y=v-((pow(v, 3.)/3.)+(pow(u, 2.)*v));
			pos.z=pow(u, 2.)-pow(v, 2.);
		}

		if (uSelectedShape == 7.0) {
			pos.x=pow(cos(u)*cos(v),3.);
			pos.y=pow(sin(u)*cos(v),3.);
			pos.z=pow(sin(v), 3.);
		}
		
		if (uSelectedShape == 8.0) {
			pos.x=v*cos(u);
			pos.y=cos(u+(1.5 * v));
			pos.z=v*sin(u);
		}

		if (uSelectedShape == 9.0) {
			pos.x=sin(u);
			pos.y=sin(v);
			pos.z=sin(u+v);
		}

		if (uSelectedShape == 10.0) {
			pos.x=0.2*(-1. * u)*(u+2.)*pow(2.71828,(0.11*v))*cos(v);
			pos.y=0.2*(-1. * u)*(u+2.)*pow(2.71828,(0.11*v))*sin(v);
			pos.z=u;
		}

		if (uSelectedShape == 11.0) {
			pos.x=sqrt(1.+pow(v,2.))*cos(u);
			pos.y=sqrt(1.+pow(v,2.))*sin(4. * u);
			pos.z=v;
		}

		if (uSelectedShape == 12.0) {
			pos.x=sqrt(10.* v)*cos(u);
			pos.y=sqrt(10. * v)*sin(u);
			pos.z=cos(5. * u);
		}

		if (uSelectedShape == 13.0) {
			pos.x=v*cos(u);
			pos.y=v*sin(u);
			pos.z=v*sin(2. * u);
		}
		
		if (uSelectedShape == 14.0) {
			pos.x=u*cos(v)*sin(u);
			pos.y=u*cos(u)*cos(v);
			pos.z=sin(2. * v);
		}

		if (uSelectedShape == 15.0) {
			pos.x=(2.*(cos(u)+u*sin(u))*sin(v))/(1.+pow(u, 2.)*sin(v)*sin(v));
			pos.y=(2.*(-u*cos(u)+sin(u))*sin(v))/(1.+pow(u,2.)*sin(v)*sin(v));
			pos.z=log(tan(v/2.))+(2.*cos(v))/(1.+pow(u, 2.)*sin(v)*sin(v));
		}

		if (uSelectedShape == 16.0) {
			pos.x=u-(pow(u,3.)/3.)+u*pow(v,2.);
			pos.y=v-(pow(v,3.)/3.)+pow(u,2.)*v;
			pos.z=pow(u,3.)-pow(v,3.);
		}

		if (uSelectedShape == 17.0) {
			pos.x=(4.+cos(v)*(1.+sin(u)))*cos(u);
			pos.y=(4.+cos(v)*(1.+sin(u)))*sin(u);
			pos.z=sin(v)*(1.+sin(u));
		}

		if (uSelectedShape == 18.0) {
			pos.x=0.66 * cos(1.03 + u)*(2.+cos(v));
			pos.y=0.75 * cos(1.41-u)*(2.+0.87*cos(2.44+v));
			pos.z=0.87 * cos(2.44+u)*(2.+0.5*cos(0.38-v));
		}

		if (uSelectedShape == 19.0) {
			pos.x=cos(v)*(1.+cos(u))*sin(v/8.);
			pos.y=sin(u)*sin(v/8.)+cos(v/8.)*1.5;
			pos.z=sin(v)*(1.+cos(u))*sin(v/8.);
		}

		if (uSelectedShape == 20.0) {
			pos.x=cos(u+v)/(sqrt(2.)+cos(v-u));
			pos.y=sin(v-u)/(sqrt(2.)+cos(v-u));
			pos.z=sin(u+v)/(sqrt(2.)+cos(v-u));
		}

		if (uSelectedShape == 22.0) {
			pos.x=cos(u)*(6.-(5./4. + sin(3.*v))*sin(v-3.*u)) / 2.;
			pos.y=(6.-(5./4. + sin(3.*v))*sin(v-3.*u))*sin(u) / 2.;
			pos.z=-cos(v-3.*u)*(5./4.+sin(3.*v)) / 2.;
		}

		if (uCurlIntensity > 0.) {
			pos += curlNoise(pos * uCurlIntensity * uTime) * uCurlAmplitude;
		}
		
		vec4 worldPosition = modelMatrix * vec4(pos.xyz, 1.0);
		vec4 mvPosition = viewMatrix * worldPosition;
		vec4 projectedPosition = projectionMatrix * mvPosition;
		
		vWorldPosition = worldPosition;

		gl_PointSize = uParticleSize;

		// Size attenuation;
		gl_PointSize *= (uSizeAttenuationMultiplier / - mvPosition.z);
		// gl_PointSize *= 5.;
		gl_Position = projectedPosition;

		float dist = distance(pos, vec3(.0));
		
		vColor = mix(uInnerColor, uOuterColor, pow(dist * distanceColorMultiplier, 2.));
		vHighPrecisionZW = gl_Position.zw;
		#include <beginnormal_vertex>
		#include <defaultnormal_vertex>
		#include <logdepthbuf_vertex>
		#include <fog_vertex>
		#include <shadowmap_vertex>

	}
`;
const vertexShaderWithoutAttenuation = vertexShader.replace('gl_PointSize *= (uSizeAttenuationMultiplier / - mvPosition.z);', '').replace('gl_PointSize = uParticleSize;', 'gl_PointSize = 2.;')
const depthFragmentShader = `

#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

varying vec2 vHighPrecisionZW;

void main() {

	#include <clipping_planes_fragment>

	vec4 diffuseColor = vec4( 1.0 );

	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>

	#include <logdepthbuf_fragment>

	// Higher precision equivalent of gl_FragCoord.z. This assumes depthRange has been left to its default values.
	float fragCoordZ = 0.5 * vHighPrecisionZW[0] / vHighPrecisionZW[1] + 0.5;

	gl_FragColor = packDepthToRGBA( fragCoordZ );
}
`;

// const distanceVertex = `
// 	#define DISTANCE

// 	uniform sampler2D uPositions;
// 	uniform vec3 uInnerColor;
// 	uniform vec3 uOuterColor;
// 	uniform float uCurlIntensity;
// 	uniform float uCurlAmplitude;
// 	uniform float uSelectedShape;
// 	uniform float uParticleSize;
// 	uniform float uSizeAttenuationMultiplier;
// 	uniform float uTime;
// 	${curlNoise}
// 	const float PI = 3.1415926535897932384626433832795;

// 	varying vec4 vWorldPosition;

// 	void main() {

// 		float u = position.x;
// 		float v = position.y;
// 		vec3 pos = position.xyz;

// 		float distanceColorMultiplier;

// 		if(uSelectedShape == 1.0) {
// 			distanceColorMultiplier = 0.2;
// 			pos.x=((1. + (sin(PI * u)*sin(PI * v)))*sin((4. * PI) * v));
// 			pos.y=((1. + (sin(PI * u)*sin(PI * v)))*cos((4. * PI) * v));
// 			pos.z=((cos(PI * u)*sin(PI * v)+(4.*v)-2.));
// 		}

// 		if (uSelectedShape == 2.0) {
// 			distanceColorMultiplier = 0.9;
// 		}

// 		if (uSelectedShape == 3.0) {
// 			pos.x=(3.+ sin(2.*PI*u)*sin(2.*PI*v))*sin(2.*PI*v);
// 			pos.y=(3.+ sin(2.*PI*u)*sin(2.*PI*v))*cos(2.*PI*v);
// 			pos.z=cos(2.*PI*u)*sin(2.*PI*v)+4.*v-2.;
// 		}


// 		if (uSelectedShape == 4.0) {

// 			pos.x=u*cos(v);
// 			pos.y=u*sin(v);
// 			pos.z=v;

// 		}

// 		if (uSelectedShape == 6.0) {
// 			pos.x=u-((pow(u, 3.)/3.)+(pow(v,2.)*u));
// 			pos.y=v-((pow(v, 3.)/3.)+(pow(u, 2.)*v));
// 			pos.z=pow(u, 2.)-pow(v, 2.);
// 		}

// 		if (uSelectedShape == 7.0) {
// 			pos.x=pow(cos(u)*cos(v),3.);
// 			pos.y=pow(sin(u)*cos(v),3.);
// 			pos.z=pow(sin(v), 3.);
// 		}
// 		if (uCurlIntensity > 0.) {
// 			pos += curlNoise(pos * uCurlIntensity * uTime) * uCurlAmplitude;
// 		}

// 		// vec4 worldPosition = modelMatrix * vec4( pos.xyz, 1.0 );
// 		// vec4 mvPosition = viewMatrix * worldPosition;
	
		
// 		// vWorldPosition = worldPosition;
		
// 		vec4 worldPosition = modelMatrix * vec4(pos.xyz, 1.0);
// 		vec4 mvPosition = viewMatrix * worldPosition;
  
// 		//gl_PointSize = 50.0 / length(mvPosition.xyz);
// 		gl_PointSize = 2.0;
  
// 		vWorldPosition = worldPosition;
  
// 		gl_Position = projectionMatrix * mvPosition;
	
// 	}
// `

// const distanceFragment = `
// #define DISTANCE

// uniform vec3 referencePosition;
// uniform float nearDistance;
// uniform float farDistance;
// varying vec4 vWorldPosition;

// #include <common>
// #include <packing>
// #include <uv_pars_fragment>
// #include <map_pars_fragment>
// #include <alphamap_pars_fragment>
// #include <alphatest_pars_fragment>
// #include <clipping_planes_pars_fragment>

// void main () {

// 	#include <clipping_planes_fragment>

// 	vec4 diffuseColor = vec4( 1.0 );

// 	#include <map_fragment>
// 	#include <alphamap_fragment>
// 	#include <alphatest_fragment>

// 	float dist = length( vWorldPosition.xyz - referencePosition );
// 	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
// 	dist = saturate( dist ); // clamp to [ 0, 1 ]

// 	gl_FragColor = packDepthToRGBA( dist );

// }
// `;

const uniforms = UniformsUtils.merge([
	UniformsLib.shadowmap,
	UniformsLib.lights,
	UniformsLib.ambient,
	{
		uPositions: {
			value: null,
		},
		uInnerColor: {
			value: {
				r: 1,
				g: 1,
				b: 1,
			}
		},
		uOuterColor: {
			value: {
				r: 1,
				g: 1,
				b: 1,
			}
		},
		uSelectedShape: {
			value: 1
		},
		uParticleSize: {
			value: 4.0
		},
		uSizeAttenuationMultiplier: {
			value: 10,
		},
		uTime: {
			value: 0,
		},
		uCurlIntensity: {
			value: 0,
		},
		uCurlAmplitude: {
			value: 0,
		}
	}])

//keep these outside the react rendering cycle, we dont need to re-render the component when these change
let pause;
const Particles = () => {
	const { scene: currentScene } = useThree();
	const colors = getRandomColors();
	const [innerColor, outerColor] = colors;
	const [{ shape: selectedShape, count: particlesCount }, set] = useControls(() => ({
		shape: {
			options: {
				'1': 1,
				'Fibonacci sphere': 2,
				'3': 3,
				'4': 4,
				'6': 6,
				'7': 7,
				'8': 8,
				'9': 9,
				'10': 10,
				'11': 11,
				'12': 12,
				'13': 13,
				'14': 14,
				'15': 15,
				'16': 16,
				'17': 17,
				'18': 18,
				'19': 19,
				'20': 20,
				'22': 22
			}
		},
		innerColor: {
			value: innerColor,
			onChange: (v) => {
				uniforms.uInnerColor.value = new Color(v)
			},
		},
		outerColor: {
			value: outerColor,
			onChange: (v) => {
				uniforms.uOuterColor.value = new Color(v)
			}
		},
		curlIntensity: {
			value: 0,
			min: 0,
			max: 0.2,
			step: 0.001,
			onChange: (v) => { uniforms.uCurlIntensity.value = v },
		},
		curlAmplitude: {
			value: 0,
			min: 0,
			max: 0.3,
			step: 0.01,
			onChange: (v) => { uniforms.uCurlAmplitude.value = v },
		},

		backgroundColor: {
			value: new Color(0.12, 0.12, 0.12).multiplyScalar(255),
			onChange: (v) => {
				currentScene.background = new Color(v.r, v.g, v.b).multiplyScalar(1 / 255)
			}
		},
		'Particles Controls': folder({
			count: {
				value: 128 * 8,
				min: 42,
				max: 128 * 25,
				step: 128,
			},
			size: {
				value: 17,
				min: 1,
				max: 100,
				step: 1,
				onChange: (v) => { uniforms.uParticleSize.value = v },
			},
			sizeAttenuationMultiplier: {
				value: 2.5,
				min: 1,
				max: 12,
				step: 0.5,
				onChange: (v) => { uniforms.uSizeAttenuationMultiplier.value = v },
			}
		}, {
			collapsed: true
		}),
	}));

	const points = useRef();

	const particlesPosition = useMemo(() => {
		const length = particlesCount * particlesCount;
		const particles = new Float32Array(length * 3);

		for (let i = 0; i < length; i++) {
			const i3 = i * 3;

			let x = Math.random();
			let y = Math.random();
			let z = Math.random();

			//calculate this on CPU cause i need iterations
			if (selectedShape === 2) {
				const phi = Math.PI * (Math.sqrt(5.) - 1.);
				y = 1 - (i / (length)) * 2;
				const radius = Math.sqrt(1 - y * y);
				const theta = phi * i;
				x = Math.cos(theta) * radius
				z = Math.sin(theta) * radius
				x *= 5;
				y *= 5;
				z *= 5;
			}

			if (selectedShape === 4) {
				x = MathUtils.randFloat(-2, 2);
				y = MathUtils.randFloat(-Math.PI, Math.PI);
			}

			if (selectedShape === 6) {

				x = MathUtils.randFloat(-1, 1);
				y = MathUtils.randFloat(-1, 1);
			}

			if (selectedShape === 7) {
				x = MathUtils.randFloat(-Math.PI / 2, Math.PI / 2);
				y = MathUtils.randFloat(-Math.PI, Math.PI);
			}
			
			if (selectedShape === 8) {
				x = MathUtils.randFloat(0, Math.PI * 2);
				y = MathUtils.randFloat(0, 7);
			}

			if (selectedShape === 9) {
				x = MathUtils.randFloat(-Math.PI, Math.PI);
				y = MathUtils.randFloat(-Math.PI, Math.PI);
			}

			if (selectedShape === 10) {
				x = MathUtils.randFloat(-1, 1);
				y = MathUtils.randFloat(0, 4*Math.PI);
			}

			if (selectedShape === 11) {
				x = MathUtils.randFloat(0, 2 * Math.PI);
				y = MathUtils.randFloat(-1, 1);
			}

			if (selectedShape === 12) {
				x = MathUtils.randFloat(0, 2 * Math.PI);
				y = MathUtils.randFloat(0, 1);
			}

			if (selectedShape === 13) {
				x = MathUtils.randFloat(0, 2 * Math.PI);
				y = MathUtils.randFloat(-1, 1);
			}

			if (selectedShape === 14) {
				x = MathUtils.randFloat(0, 2 * Math.PI);
				y = MathUtils.randFloat(-Math.PI, Math.PI);
			}

			if (selectedShape === 15) {
				x = MathUtils.randFloat(-4.5, 4.5);
				y = MathUtils.randFloat(0.03, 3.11);
			}

			if (selectedShape === 16) {
				x = MathUtils.randFloat(-1.5, 1.5);
				y = MathUtils.randFloat(-1.5, 1.5);
			}

			if (selectedShape === 17) {
				x = MathUtils.randFloat(0, Math.PI * 2);
				y = MathUtils.randFloat(0, Math.PI * 2);
			}

			if (selectedShape === 18) {
				x = MathUtils.randFloat(0, Math.PI * 2);
				y = MathUtils.randFloat(0, Math.PI * 2);
			}


			if (selectedShape === 19) {
				x = MathUtils.randFloat(0, Math.PI * 2);
				y = MathUtils.randFloat(0, Math.PI * 4);
			}

			if (selectedShape === 20) {
				x = MathUtils.randFloat(0, Math.PI);
				y = MathUtils.randFloat(0, Math.PI * 2);
			}

			if (selectedShape === 22) {
				x = MathUtils.randFloat(0, Math.PI * 2);
				y = MathUtils.randFloat(0, Math.PI * 2);
			}
			particles[i3 + 0] = x;
			particles[i3 + 1] = y;
			particles[i3 + 2] = z;
		}

		return particles;

	}, [particlesCount, selectedShape]);

	useEffect(() => {
		uniforms.uSelectedShape.value = selectedShape;
		//TODO: should colors change on each re-render?
		set({ innerColor, outerColor });
	}, [selectedShape]);


	useFrame((state) => {
		if (pause) return;
		const { clock } = state;
		uniforms.uTime.value = clock.elapsedTime;
	});

	return (
		<points
			castShadow
			receiveShadow
			key={`points${selectedShape}${particlesPosition.length}`}
			frustumCulled={false}
			ref={points}
			customDepthMaterial={new ShaderMaterial({
				vertexShader: vertexShaderWithoutAttenuation,
				fragmentShader: depthFragmentShader,
				uniforms: uniforms,
				depthTest: true,
				depthWrite: true,
				side: BackSide,
				blending: NoBlending
			})}
			// customDistanceMaterial={
			// 	new ShaderMaterial({
			// 		vertexShader: distanceVertex,
			// 		fragmentShader: distanceFragment,
			// 		uniforms: uniforms,
			// 		depthTest: true,
			// 		depthWrite: true,
			// 		side: BackSide,
			// 		blending: MultiplyBlending
			// 	})
			// }
		>
			<bufferGeometry>
				<bufferAttribute
					attach="attributes-position"
					count={particlesPosition.length / 3}
					array={particlesPosition}
					itemSize={3}
				/>
			</bufferGeometry>
			<shaderMaterial
				lights={true}
				shadowSide={DoubleSide}
				depthTest={true}
				depthWrite={true}
				fragmentShader={fragmentShader}
				vertexShader={vertexShader}
				uniforms={uniforms}
				blending={NoBlending}

			/>
		</points>
	);
};

const Scene = () => {
	return (
		<>
			<Particles />
			<Backdrop
				position={[-3, -7, 0]} rotation={[0, Math.PI / 2, 0]} scale={[45, 20, 30]}
				floor={0.25} // Stretches the floor segment, 0.25 by default
				receiveShadow={true}
				segments={20} // Mesh-resolution, 20 by default
			>
			<meshStandardMaterial color="#F5F5F5" />
			</Backdrop>
		</>
	);
};

let lightTimer = 0;
const Light = () => {
	const lightRef = useRef();
	const [{animateLightPosition}] = useControls(() => ({
		animateLightPosition: {
			value: true
		}
	}))
	useFrame(({clock}) => {
		if(animateLightPosition) {
			lightTimer += 0.025;
			lightRef.current.position.set(Math.sin(lightTimer) * 10, 4, Math.cos(lightTimer) * -5)
		}
	})
	return <>
		{/* <ambientLight intensity={1} color={"white"}/> */}
		{/* <spotLight
			castShadow
			ref={pointLightRef}
			color={"white"}
			position={LIGHT_POSITION}
			intensity={0.3}
			shadow-mapSize-width={2048 * 4}
			shadow-mapSize-height={2048 * 4}
			shadow-camera-left={-40}
			shadow-camera-right={40}
			shadow-camera-top={40}
			shadow-camera-bottom={-40}
			shadow-camera-near={1}
			shadow-camera-far={40}
			// shadow-bias={0.0003}
			shadow-darkness={1}
		/> */}
		{/* <pointLight
			castShadow
			color={"white"}
			position={LIGHT_POSITION}
			intensity={3}
			
			shadow-mapSize-width={2048 * 2}
			shadow-mapSize-height={2048}
			// shadow-bias={0.01}
			shadow-darkness={1}
			shadow-camera-near={4}
			shadow-camera-far={100}
			shadow-camera-left={-40}
			shadow-camera-right={40}
			shadow-camera-top={40}
			shadow-camera-bottom={-40}
		/>  */}
		<directionalLight 
			castShadow
			ref={lightRef}
			color={"white"}
			position={[10, 4, -5]}
			intensity={3}
			shadow-mapSize-width={2048 * 6}
			shadow-mapSize-height={2048 * 4}
			shadow-camera-near={1}
			shadow-camera-far={50}
			shadow-camera-left={-40}
			shadow-camera-right={40}
			shadow-camera-top={40}
			shadow-camera-bottom={-40}
			// shadow-bias={-0.0001}
			shadow-darkness={0.45}
		/>
</>
}

//TODO: fix resize re-render
export default function App() {

	return (
		<>
			<Canvas
				shadows={true}
				camera={{
					near: 0.1,
					far: 90000,
					fov: 45,
					position: [15, 18, 18],
				}}
				dpr={Math.max(window.devicePixelRatio, 2)}
			>
				{/* <Stats /> */}
				<OrbitControls />
				<ambientLight intensity={1} />
				<Suspense fallback={null}>
					<Light />
					<Scene />
				</Suspense>
			</Canvas>
		</>
	);
}
